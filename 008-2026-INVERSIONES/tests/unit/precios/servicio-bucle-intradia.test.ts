// La segunda ranura del bucle del servicio de precios: durante la rueda, un ciclo de precios intradía cada
// `cicloMs`, sin tocar la corrida de las 18:00. Reloj, corredor y temporizador falsos; huella en una carpeta temporal.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TIC_MS, crearBucle, iniciarBucle, type Dependencias, type Senales } from "@/servicio-precios/bucle";
import { leerClaveValor } from "@/servicio-precios/estado";
import { CONFIG_INTRADIA_POR_OMISION, type ConfigIntradia } from "@/servicio-precios/intradia-configuracion";
import type { Corredor, ResultadoTarea, Tarea } from "@/servicio-precios/tareas";

const cot = (texto: string): number => new Date(`${texto.replace(" ", "T")}:00-05:00`).getTime();
const carpeta = (): string => mkdtempSync(path.join(tmpdir(), "inv-008-precios-intradia-"));
const huella = (dir: string): Record<string, string> => leerClaveValor(readFileSync(path.join(dir, "intradia"), "utf8"));
const CICLO = 60_000;

type Llamada = { tarea: Tarea; args: readonly string[]; plazoMs: number };

/** Corredor falso: cada llamada a «intradia» toma el siguiente código de la lista (el último se repite). */
function corredorFalso(codigosIntradia: readonly string[] = ["0"], opciones: { retener?: boolean } = {}) {
  const llamadas: Llamada[] = [];
  let detenido = 0;
  let soltar: () => void = () => undefined;
  let n = 0;
  const corredor: Corredor = {
    async correr(tarea, args, plazoMs) {
      if (detenido > 0) return { tarea, codigo: "DETENIDO", duracionMs: 0 };
      llamadas.push({ tarea, args, plazoMs });
      if (opciones.retener) await new Promise<void>((ok) => (soltar = ok));
      const codigo = tarea === "intradia" && !args.includes("--depurar") ? codigosIntradia[Math.min(n++, codigosIntradia.length - 1)]! : "0";
      return { tarea, codigo, duracionMs: 5 } satisfies ResultadoTarea;
    },
    detener() {
      detenido += 1;
      soltar();
    },
  };
  return { corredor, llamadas, soltar: () => soltar() };
}

function armar(opciones: { inicio?: string; config?: Partial<ConfigIntradia> | null; credencialOk?: boolean; codigos?: readonly string[]; retener?: boolean } = {}) {
  let t = cot(opciones.inicio ?? "2027-02-09 10:00");
  const mensajes: string[] = [];
  const programados: Array<{ ms: number; fn: () => void; cancelado: boolean }> = [];
  const falso = corredorFalso(opciones.codigos, { retener: opciones.retener });
  const deps: Dependencias = {
    dir: carpeta(),
    ahora: () => t,
    registrar: (m) => mensajes.push(m),
    corredor: falso.corredor,
    credencial: opciones.credencialOk === false ? { ok: false, estado: "SIN_SECRETO", motivo: "sin secreto" } : { ok: true },
    programar: (fn, ms) => {
      const p = { fn, ms, cancelado: false };
      programados.push(p);
      return () => (p.cancelado = true);
    },
    ...(opciones.config === null ? {} : { intradia: { ...CONFIG_INTRADIA_POR_OMISION, ...opciones.config } }),
  };
  return { deps, mensajes, programados, falso, ir: (texto: string) => (t = cot(texto)), adelantar: (ms: number) => (t += ms) };
}

describe("el ciclo intradía del bucle", () => {
  it("en ventana, con secreto y encendido: la primera vez del día depura y luego trae; los demás ciclos solo traen", async () => {
    const { deps, falso, adelantar } = armar();
    const bucle = crearBucle(deps);
    await bucle.cicloIntradia();
    expect(falso.llamadas.map((l) => [l.tarea, [...l.args]])).toEqual([["intradia", ["--depurar"]], ["intradia", []]]);
    adelantar(CICLO);
    await bucle.cicloIntradia();
    expect(falso.llamadas.slice(2).map((l) => [l.tarea, [...l.args]])).toEqual([["intradia", []]]);
  });

  it("el plazo de cada ciclo es menor que el ciclo (nunca se encima con el siguiente)", async () => {
    const { deps, falso } = armar();
    await crearBucle(deps).cicloIntradia();
    for (const l of falso.llamadas) expect(l.plazoMs).toBeLessThan(CICLO);
  });

  it("al día siguiente vuelve a depurar", async () => {
    const { deps, falso, ir } = armar();
    const bucle = crearBucle(deps);
    await bucle.cicloIntradia();
    ir("2027-02-10 10:00");
    await bucle.cicloIntradia();
    expect(falso.llamadas.filter((l) => l.args.includes("--depurar"))).toHaveLength(2);
  });

  it("apagado, sin secreto o sin configuración: no trae nada", async () => {
    for (const o of [{ config: { encendido: false } }, { credencialOk: false }, { config: null }] as const) {
      const { deps, falso } = armar(o);
      await crearBucle(deps).cicloIntradia();
      expect(falso.llamadas).toEqual([]);
    }
  });

  it("fuera de la ventana (antes, después, fin de semana): no trae nada", async () => {
    for (const inicio of ["2027-02-09 09:29", "2027-02-09 16:25", "2027-02-09 18:00", "2027-02-13 12:00", "2027-02-14 12:00"]) {
      const { deps, falso } = armar({ inicio });
      await crearBucle(deps).cicloIntradia();
      expect(falso.llamadas, inicio).toEqual([]);
    }
  });

  it("código 4 (día no hábil): no vuelve a intentarlo ese día, pero sí al siguiente", async () => {
    const { deps, falso, adelantar, ir } = armar({ codigos: ["4", "0"] });
    const bucle = crearBucle(deps);
    await bucle.cicloIntradia();
    const antes = falso.llamadas.length;
    adelantar(CICLO);
    await bucle.cicloIntradia();
    adelantar(CICLO);
    await bucle.cicloIntradia();
    expect(falso.llamadas).toHaveLength(antes);
    ir("2027-02-10 10:00");
    await bucle.cicloIntradia();
    expect(falso.llamadas.length).toBeGreaterThan(antes);
  });

  it("código 7 (Yahoo limita con 429): espera exponencial, con tope; un ciclo bueno la reinicia", async () => {
    const { deps, falso, adelantar, mensajes } = armar({ codigos: ["7", "7", "0", "0"] });
    const bucle = crearBucle(deps);
    const trae = () => falso.llamadas.filter((l) => l.tarea === "intradia" && !l.args.includes("--depurar")).length;
    await bucle.cicloIntradia(); // 1.er 7 → espera 2 ciclos
    expect(trae()).toBe(1);
    adelantar(CICLO);
    await bucle.cicloIntradia(); // dentro de la espera: se omite
    expect(trae()).toBe(1);
    adelantar(CICLO);
    await bucle.cicloIntradia(); // pasada la espera: trae (2.º 7) → espera 4 ciclos
    expect(trae()).toBe(2);
    adelantar(3 * CICLO);
    await bucle.cicloIntradia();
    expect(trae()).toBe(2);
    adelantar(CICLO);
    await bucle.cicloIntradia(); // pasada la espera: trae (0) → sin espera
    expect(trae()).toBe(3);
    adelantar(CICLO);
    await bucle.cicloIntradia();
    expect(trae()).toBe(4);
    expect(mensajes.some((m) => m.includes("429") || m.includes("limit"))).toBe(true);
  });

  it("otros fallos (1, TIEMPO, NO_ARRANCO) quedan en el log y NO paran el ciclo ni lo hacen esperar", async () => {
    for (const codigo of ["1", "TIEMPO", "NO_ARRANCO", "3"]) {
      const { deps, falso, adelantar, mensajes } = armar({ codigos: [codigo, "0"] });
      const bucle = crearBucle(deps);
      await bucle.cicloIntradia();
      adelantar(CICLO);
      await bucle.cicloIntradia();
      expect(falso.llamadas.filter((l) => !l.args.includes("--depurar"))).toHaveLength(2);
      expect(mensajes.some((m) => m.includes(codigo)), codigo).toBe(true);
    }
  });

  it("si el ciclo anterior sigue en curso, el nuevo se omite y lo dice", async () => {
    const { deps, falso, mensajes } = armar({ retener: true });
    const bucle = crearBucle(deps);
    const primero = bucle.cicloIntradia();
    await vi.waitFor(() => expect(falso.llamadas.length).toBeGreaterThan(0));
    await bucle.cicloIntradia();
    expect(falso.llamadas).toHaveLength(1);
    expect(mensajes.some((m) => m.includes("sigue en curso"))).toBe(true);
    falso.soltar();
    await vi.waitFor(() => expect(falso.llamadas.length).toBeGreaterThan(1));
    falso.soltar();
    await primero;
  });

  it("después de detener(), no lanza nada", async () => {
    const { deps, falso } = armar();
    const bucle = crearBucle(deps);
    await bucle.detener();
    await bucle.cicloIntradia();
    expect(falso.llamadas).toEqual([]);
  });

  it("deja la huella `intradia` (estado, último ciclo, código y fallos seguidos) para el vigía, solo ASCII clave=valor", async () => {
    const { deps, adelantar } = armar({ codigos: ["7", "0"] });
    const bucle = crearBucle(deps);
    await bucle.cicloIntradia();
    expect(huella(deps.dir)).toMatchObject({ formato: "1", estado: "LIMITADO", codigo: "7", fallos: "1" });
    adelantar(2 * CICLO);
    await bucle.cicloIntradia();
    expect(huella(deps.dir)).toMatchObject({ estado: "ESPERANDO", codigo: "0", fallos: "0" });
  });

  it("el log nunca trae precios, nemotécnicos ni cantidades: solo códigos y conteos del servicio", async () => {
    const { deps, mensajes } = armar({ codigos: ["3", "7"] });
    const bucle = crearBucle(deps);
    await bucle.cicloIntradia();
    expect(mensajes.join("\n")).not.toMatch(/\$|COP|\.CL/);
  });
});

describe("la corrida de las 18:00 sigue igual junto al ciclo intradía", () => {
  it("el arranque avisa del ciclo (o de que está apagado) sin cambiar el aviso de las 18:00", () => {
    const encendido = armar();
    crearBucle(encendido.deps);
    expect(encendido.mensajes.join("\n")).toMatch(/18:00 COT/);
    expect(encendido.mensajes.join("\n")).toMatch(/intrad[ií]a/i);
    const apagado = armar({ config: { encendido: false } });
    crearBucle(apagado.deps);
    expect(apagado.mensajes.join("\n")).toMatch(/intrad[ií]a apagado/i);
  });

  it("la corrida de las 18:00 espera a un ciclo intradía en curso antes de lanzar sus tareas (el corredor corre una tarea a la vez)", async () => {
    const { deps, falso, ir } = armar({ inicio: "2027-02-09 16:20", retener: true });
    const bucle = crearBucle(deps);
    const ciclo = bucle.cicloIntradia();
    await vi.waitFor(() => expect(falso.llamadas.length).toBe(1));
    ir("2027-02-09 18:00");
    await bucle.tic();
    expect(falso.llamadas.map((l) => l.tarea)).toEqual(["intradia"]); // la corrida diaria aún no lanzó su primera tarea
    falso.soltar(); // termina la depuración del ciclo
    await vi.waitFor(() => expect(falso.llamadas.length).toBe(2));
    falso.soltar(); // termina el ciclo
    await ciclo;
    await vi.waitFor(() => expect(falso.llamadas.map((l) => l.tarea)).toContain("precios"));
    falso.soltar();
    await vi.waitFor(() => expect(falso.llamadas.map((l) => l.tarea)).toContain("fondo"));
    falso.soltar();
    await bucle.esperar();
  });
});

describe("iniciarBucle y el temporizador del ciclo intradía", () => {
  const senales = (): Senales => ({ once: () => undefined, removeListener: () => undefined });

  it("encendido: programa un temporizador cada `cicloMs` (además del tic de un minuto) y lo cancela al parar", async () => {
    const { deps, programados } = armar({ config: { cicloMs: 120_000 } });
    const s = new Map<string, (senal: NodeJS.Signals) => void>();
    const promesa = iniciarBucle(deps, { once: (n, f) => void s.set(n, f), removeListener: () => undefined });
    expect(programados.map((p) => p.ms).sort((a, b) => a - b)).toEqual([TIC_MS, 120_000].sort((a, b) => a - b));
    s.get("SIGTERM")!("SIGTERM");
    await promesa;
    expect(programados.every((p) => p.cancelado)).toBe(true);
  });

  it("apagado: solo el tic de un minuto", async () => {
    const { deps, programados } = armar({ config: { encendido: false } });
    const s = new Map<string, (senal: NodeJS.Signals) => void>();
    const promesa = iniciarBucle(deps, { once: (n, f) => void s.set(n, f), removeListener: () => undefined });
    expect(programados.map((p) => p.ms)).toEqual([TIC_MS]);
    s.get("SIGINT")!("SIGINT");
    await promesa;
    void senales;
  });
});
