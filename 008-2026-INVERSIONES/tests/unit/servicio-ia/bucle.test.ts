// El bucle del servicio inv-008-ia: latido cada minuto, la corrida a la hora de config_ia en día hábil BVC, y EN ESPERA
// (sin caerse) si falta la credencial.
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TOPE_CIERRE_MS, crearBucle, iniciarBucle, type DependenciasBucle } from "@/servicio-ia/bucle";
import { VIGENTE_FICTICIA } from "../ia/config/apoyo/config.ficticio";

const cot = (texto: string): number => new Date(`${texto}:00.000-05:00`).getTime();

function montar(extra: Partial<DependenciasBucle> = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "inv-008-ia-"));
  const lineas: string[] = [];
  const reloj = { t: cot("2027-03-17T18:30") };
  const deps: DependenciasBucle = {
    dir,
    ahora: () => reloj.t,
    registrar: (m) => void lineas.push(m),
    credencial: { ok: true },
    programar: () => () => undefined,
    leerConfig: vi.fn(async () => VIGENTE_FICTICIA),
    esHabil: vi.fn(async () => true),
    correr: vi.fn(async () => ({ estado: "HECHA" as const, porTipo: { DIARIO: "PUBLICADO" as const } })),
    esperar: vi.fn(async () => undefined),
    ...extra,
  };
  const latido = (): string => readFileSync(path.join(dir, "bucle"), "utf8");
  return { deps, lineas, reloj, latido };
}

describe("crearBucle", () => {
  it("cada tic deja el latido; antes de la hora no corre nada", async () => {
    const m = montar();
    const bucle = crearBucle(m.deps);
    await bucle.tic();
    expect(m.latido()).toContain("estado=ESPERANDO");
    expect(m.deps.correr).not.toHaveBeenCalled();
  });

  it("a la hora de config_ia (19:00) en día hábil: corre con la configuración vigente y la fecha de Colombia", async () => {
    const m = montar();
    const bucle = crearBucle(m.deps);
    m.reloj.t = cot("2027-03-17T19:00");
    await bucle.tic();
    await bucle.esperar();
    expect(m.deps.correr).toHaveBeenCalledWith(VIGENTE_FICTICIA, new Date("2027-03-17T00:00:00.000Z"));
    expect(m.lineas.join("\n")).toContain("DIARIO → PUBLICADO");
  });

  it("la ranura que no es la de la configuración no corre (20:00 con la hora en 19:00)", async () => {
    const m = montar();
    const bucle = crearBucle(m.deps);
    m.reloj.t = cot("2027-03-17T19:00");
    await bucle.tic();
    await bucle.esperar();
    m.reloj.t = cot("2027-03-17T20:00");
    await bucle.tic();
    await bucle.esperar();
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
  });

  it("en un festivo de la BVC no corre", async () => {
    const m = montar({ esHabil: vi.fn(async () => false) });
    const bucle = crearBucle(m.deps);
    m.reloj.t = cot("2027-03-22T19:00");
    await bucle.tic();
    await bucle.esperar();
    expect(m.deps.correr).not.toHaveBeenCalled();
    expect(m.lineas.join("\n")).toContain("no es día hábil");
  });

  it("con la configuración apagada o sin ella no hace nada", async () => {
    for (const config of [null, { ...VIGENTE_FICTICIA, modo: "apagado" as const }]) {
      const m = montar({ leerConfig: vi.fn(async () => config) });
      const bucle = crearBucle(m.deps);
      m.reloj.t = cot("2027-03-17T19:00");
      await bucle.tic();
      await bucle.esperar();
      expect(m.deps.correr).not.toHaveBeenCalled();
      expect(m.deps.esHabil).not.toHaveBeenCalled();
    }
  });

  it("sin la credencial queda EN ESPERA: late, lo dice y nunca lee la base", async () => {
    const m = montar({ credencial: { ok: false, estado: "SIN_SECRETO", motivo: "sin INV_IA_DATABASE_URL: en espera" } });
    const bucle = crearBucle(m.deps);
    m.reloj.t = cot("2027-03-17T19:00");
    await bucle.tic();
    await bucle.esperar();
    expect(m.latido()).toContain("estado=SIN_SECRETO");
    expect(m.lineas.join("\n")).toContain("sin INV_IA_DATABASE_URL");
    expect(m.deps.leerConfig).not.toHaveBeenCalled();
  });

  it("un error de la corrida no tumba el bucle: queda su nombre en el log, nunca su mensaje", async () => {
    const m = montar({ correr: vi.fn(async () => { throw new Error("mensaje con cifras 37.911,47"); }) });
    const bucle = crearBucle(m.deps);
    m.reloj.t = cot("2027-03-17T19:00");
    await bucle.tic();
    await bucle.esperar();
    await bucle.tic();
    expect(m.lineas.join("\n")).not.toContain("37.911");
    expect(m.latido()).toContain("estado=ESPERANDO");
  });
});

describe("crearBucle · revisión (ranura perdida, fallos pasajeros y una corrida a la vez)", () => {
  it("si arranca DESPUÉS de la hora de hoy (un despliegue a las 19:30), recupera la corrida del día una vez", async () => {
    const m = montar();
    m.reloj.t = cot("2027-03-17T19:30");
    const bucle = crearBucle(m.deps);
    await bucle.tic();
    await bucle.esperar();
    expect(m.deps.correr).toHaveBeenCalledWith(VIGENTE_FICTICIA, new Date("2027-03-17T00:00:00.000Z"));
    await bucle.tic();
    await bucle.esperar();
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
    expect(m.lineas.join("\n")).toContain("arrancó después");
  });

  it("si arranca antes de la hora, o en fin de semana, no recupera nada", async () => {
    for (const t of ["2027-03-17T18:59", "2027-03-20T20:15"]) {
      const m = montar();
      m.reloj.t = cot(t);
      const bucle = crearBucle(m.deps);
      await bucle.tic();
      await bucle.esperar();
      expect(m.deps.correr).not.toHaveBeenCalled();
    }
  });

  it("un fallo pasajero de la base al leer la configuración no pierde el día: reintenta con pausa", async () => {
    const leerConfig = vi.fn().mockRejectedValueOnce(Object.assign(new Error("x"), { code: "P1001" })).mockResolvedValue(VIGENTE_FICTICIA);
    const m = montar({ leerConfig });
    const bucle = crearBucle(m.deps);
    m.reloj.t = cot("2027-03-17T19:00");
    await bucle.tic();
    await bucle.esperar();
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
    expect(m.deps.esperar).toHaveBeenCalledTimes(1);
    expect(m.lineas.join("\n")).toContain("P1001");
  });

  it("si el fallo sigue, se rinde después de 3 intentos y lo dice", async () => {
    const m = montar({ leerConfig: vi.fn(async () => { throw new Error("caída"); }) });
    const bucle = crearBucle(m.deps);
    m.reloj.t = cot("2027-03-17T19:00");
    await bucle.tic();
    await bucle.esperar();
    expect(m.deps.leerConfig).toHaveBeenCalledTimes(3);
    expect(m.lineas.join("\n")).toContain("no se pudo hacer");
  });

  it("una corrida a la vez: mientras corre, el latido dice CORRIENDO y la ranura siguiente se omite", async () => {
    let soltar: () => void = () => undefined;
    const correr = vi.fn(() => new Promise<{ estado: "HECHA"; porTipo: object }>((r) => { soltar = () => r({ estado: "HECHA", porTipo: {} }); }));
    const m = montar({ correr, leerConfig: vi.fn(async () => ({ ...VIGENTE_FICTICIA, horaResumen: "18:00" as const })) });
    m.reloj.t = cot("2027-03-17T17:00");
    const bucle = crearBucle(m.deps);
    m.reloj.t = cot("2027-03-17T18:00");
    await bucle.tic();
    await vi.waitFor(() => expect(correr).toHaveBeenCalledTimes(1));
    m.reloj.t = cot("2027-03-17T19:00");
    await bucle.tic();
    expect(m.latido()).toContain("estado=CORRIENDO");
    expect(m.lineas.join("\n")).toContain("la corrida anterior sigue en curso");
    soltar();
    await bucle.esperar();
  });
});

describe("iniciarBucle", () => {
  it("si el cierre se cuelga, no espera más que el tope y sale con 0", async () => {
    vi.useFakeTimers();
    const m = montar();
    const oyentes = new Map<string, (s: NodeJS.Signals) => void>();
    const senales = { once: (s: string, f: (x: NodeJS.Signals) => void) => void oyentes.set(s, f), removeListener: (s: string) => void oyentes.delete(s) };
    const fin = iniciarBucle(m.deps, senales, () => new Promise(() => undefined));
    oyentes.get("SIGTERM")?.("SIGTERM");
    await vi.advanceTimersByTimeAsync(TOPE_CIERRE_MS + 1000);
    expect(await fin).toBe(0);
    vi.useRealTimers();
  });

  it("sale con 0 al recibir SIGTERM, deja DETENIDO y llama al cierre", async () => {
    const m = montar();
    const oyentes = new Map<string, (s: NodeJS.Signals) => void>();
    const senales = { once: (s: string, f: (x: NodeJS.Signals) => void) => void oyentes.set(s, f), removeListener: (s: string) => void oyentes.delete(s) };
    const alDetener = vi.fn(async () => undefined);
    const fin = iniciarBucle(m.deps, senales, alDetener);
    await new Promise((r) => setImmediate(r));
    oyentes.get("SIGTERM")?.("SIGTERM");
    expect(await fin).toBe(0);
    expect(alDetener).toHaveBeenCalledOnce();
    expect(m.latido()).toContain("estado=DETENIDO");
  });
});
