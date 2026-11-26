// `servicio-ia.mjs ahora`: la corrida diaria UNA vez, a mano, con las mismas reglas que la programada (apagada, día
// hábil, sin duplicar) y sin las pausas largas. Con dobles: sin base, sin red y sin Ollama.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ConfigIaVigente } from "@/ia/config/leer";
import { REINTENTOS_AHORA, bucleEnCurso, conUnaConexion, correrAhora, duracionMaximaMs, salidaDe, type DependenciasAhora } from "@/servicio-ia/ahora";
import { PAUSA_REINTENTO_MS, type ResumenCorrida } from "@/servicio-ia/corrida";
import { VIGENTE_FICTICIA } from "../ia/config/apoyo/config.ficticio";

const HOY = new Date("2027-03-17T00:00:00.000Z");
/** Un instante de ese día en Colombia (UTC−5), lejos de la ranura de las 19:00 de la configuración ficticia. */
const aLas = (hhmm: string): number => Date.parse(`2027-03-17T${hhmm}:00.000-05:00`);
const hecha = (porTipo: ResumenCorrida["porTipo"]): ResumenCorrida => ({ estado: "HECHA", porTipo });

function montar(extra: Partial<DependenciasAhora> = {}) {
  const lineas: string[] = [];
  const deps: DependenciasAhora = {
    registrar: (m) => void lineas.push(m),
    hoy: () => HOY,
    instante: () => aLas("10:13"),
    leerConfig: vi.fn(async (): Promise<ConfigIaVigente | null> => ({ ...VIGENTE_FICTICIA, modo: "local" })),
    esHabil: vi.fn(async () => true),
    bucleCorriendo: vi.fn(async () => false),
    correr: vi.fn(async () => hecha({ DIARIO: "PUBLICADO", REGLAS: "RECHAZADO", ESCENARIOS: "YA_PUBLICADO" })),
    ...extra,
  };
  return { deps, lineas };
}

describe("correrAhora", () => {
  it("corre la diaria una vez con la configuración vigente y la fecha de hoy; una línea por tarea y salida 0", async () => {
    const m = montar();
    expect(await correrAhora(m.deps)).toBe(0);
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
    expect(m.deps.correr).toHaveBeenCalledWith(expect.objectContaining({ modo: "local" }), HOY);
    expect(m.deps.esHabil).toHaveBeenCalledWith(HOY);
    expect(m.lineas).toContain("DIARIO: PUBLICADO");
    expect(m.lineas).toContain("REGLAS: RECHAZADO");
    expect(m.lineas).toContain("ESCENARIOS: YA_PUBLICADO");
  });

  it.each([null, { ...VIGENTE_FICTICIA, modo: "apagado" as const }])("con la IA apagada (%#) no hace nada y sale con 0", async (config) => {
    const m = montar({ leerConfig: vi.fn(async () => config) });
    expect(await correrAhora(m.deps)).toBe(0);
    expect(m.deps.esHabil).not.toHaveBeenCalled();
    expect(m.deps.correr).not.toHaveBeenCalled();
    expect(m.lineas.join("\n")).toMatch(/apagada/);
  });

  it("si el día no es hábil en la BVC no corre y lo dice (salida 0)", async () => {
    const m = montar({ esHabil: vi.fn(async () => false) });
    expect(await correrAhora(m.deps)).toBe(0);
    expect(m.deps.correr).not.toHaveBeenCalled();
    expect(m.lineas.join("\n")).toMatch(/no es día hábil en la BVC/);
  });

  it("si el bucle del servicio está corriendo la diaria, no corre otra a la vez (salida 1)", async () => {
    const m = montar({ bucleCorriendo: vi.fn(async () => true) });
    expect(await correrAhora(m.deps)).toBe(1);
    expect(m.deps.correr).not.toHaveBeenCalled();
    expect(m.lineas.join("\n")).toMatch(/en curso/);
  });

  it("no corre si la ranura programada de hoy empezaría mientras esta corre (dos corridas a la vez al Mac): salida 1", async () => {
    const m = montar({ instante: () => aLas("18:55") });
    expect(await correrAhora(m.deps)).toBe(1);
    expect(m.deps.correr).not.toHaveBeenCalled();
    expect(m.lineas.join("\n")).toMatch(/19:00/);
  });

  it.each(["18:37", "19:23"])("a las %s (lejos antes o ya pasada la ranura) sí corre", async (hhmm) => {
    const m = montar({ instante: () => aLas(hhmm) });
    expect(await correrAhora(m.deps)).toBe(0);
    expect(m.deps.correr).toHaveBeenCalledTimes(1);
  });

  it.each(["P2037", "P2024", "P1001"])("sin conexión a la base (%s): lo dice con el código y el porqué probable (salida 1)", async (code) => {
    const m = montar({ leerConfig: vi.fn(async () => Promise.reject(Object.assign(new Error("x"), { code }))) });
    expect(await correrAhora(m.deps)).toBe(1);
    const todo = m.lineas.join("\n");
    expect(todo).toContain(code);
    expect(todo).toMatch(/conexiones? del rol inv_ia/);
  });

  it.each(["ERROR", "FALLIDO"] as const)("una tarea en %s da salida 1", async (estado) => {
    const m = montar({ correr: vi.fn(async () => hecha({ DIARIO: "PUBLICADO", REGLAS: estado })) });
    expect(await correrAhora(m.deps)).toBe(1);
    expect(m.lineas).toContain(`REGLAS: ${estado}`);
  });

  it("un error (la base) da salida 1 con su código, nunca su mensaje", async () => {
    const error = Object.assign(new Error("fila con cifras 4613"), { code: "P1001" });
    const m = montar({ leerConfig: vi.fn(async () => Promise.reject(error)) });
    expect(await correrAhora(m.deps)).toBe(1);
    const todo = m.lineas.join("\n");
    expect(todo).toContain("P1001");
    expect(todo).not.toContain("4613");
  });
});

describe("salidaDe", () => {
  it("0 si todas terminaron (publicadas, rechazadas, ya publicadas, inactivas u omitidas); 1 con ERROR o FALLIDO", () => {
    expect(salidaDe(hecha({ DIARIO: "PUBLICADO", REGLAS: "RECHAZADO", ESCENARIOS: "OMITIDO" }))).toBe(0);
    expect(salidaDe(hecha({ DIARIO: "TAREA_INACTIVA", REGLAS: "YA_PUBLICADO", ESCENARIOS: "APAGADO" }))).toBe(0);
    expect(salidaDe(hecha({ DIARIO: "PUBLICADO", REGLAS: "ERROR" }))).toBe(1);
    expect(salidaDe(hecha({ DIARIO: "FALLIDO" }))).toBe(1);
    expect(salidaDe({ estado: "APAGADO", porTipo: {} })).toBe(0);
  });
});

describe("duracionMaximaMs", () => {
  it("los tres tipos, cada uno con su intento y su reintento al límite de la configuración, más la pausa", () => {
    expect(duracionMaximaMs({ ...VIGENTE_FICTICIA, limiteSegundos: 97 })).toBe(3 * 2 * 97_000 + REINTENTOS_AHORA.pausaMs);
  });
});

describe("REINTENTOS_AHORA", () => {
  it("como mucho un reintento, sin la pausa de 5 min de la programada", () => {
    expect(REINTENTOS_AHORA.maximo).toBeLessThanOrEqual(1);
    expect(REINTENTOS_AHORA.pausaMs).toBeLessThan(PAUSA_REINTENTO_MS);
  });
});

describe("bucleEnCurso", () => {
  const dirCon = (texto: string | null): string => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "inv-008-ia-ahora-"));
    if (texto !== null) writeFileSync(path.join(dir, "bucle"), texto);
    return dir;
  };
  it("true solo si el latido del bucle dice CORRIENDO", async () => {
    expect(await bucleEnCurso(dirCon("formato=1\nestado=CORRIENDO\narranque=1237\n"))).toBe(true);
    expect(await bucleEnCurso(dirCon("formato=1\nestado=ESPERANDO\narranque=1237\n"))).toBe(false);
    expect(await bucleEnCurso(dirCon(null))).toBe(false);
  });
  it("otro error al leer el latido (no es que falte) sube: correrAhora lo convierte en salida 1", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "inv-008-ia-ahora-"));
    mkdirSync(path.join(dir, "bucle"));
    await expect(bucleEnCurso(dir)).rejects.toMatchObject({ code: "EISDIR" });
  });
});

describe("conUnaConexion", () => {
  it("deja la URL con connection_limit=1 (el rol tiene 2 y el bucle ya usa la suya) sin tocar lo demás", () => {
    const url = "postgresql://inv_ia:clave-ficticia-4613@inv-008-db:5432/inversiones?connection_limit=2&connect_timeout=7";
    const nueva = new URL(conUnaConexion(url));
    expect(nueva.searchParams.get("connection_limit")).toBe("1");
    expect(nueva.searchParams.get("connect_timeout")).toBe("7");
    expect(nueva.username).toBe("inv_ia");
    expect(nueva.password).toBe("clave-ficticia-4613");
    expect(nueva.hostname).toBe("inv-008-db");
    expect(nueva.pathname).toBe("/inversiones");
  });
});
