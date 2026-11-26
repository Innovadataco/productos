// La lectura de la tarjeta de resumen (E5) con la base y el export simulados: el día es el de Colombia; el paquete de
// hoy sale del export de E7 (la misma función que arma los paquetes del servicio) bajo el turno de las proyecciones y
// queda en memoria un rato corto por día; sin turno (en vuelo, frecuencia u ocupado) la tarjeta no se cae; un error del
// registro se trata como «sin publicado» y se registra solo su código; un fallo de la base se propaga y otro error se
// muestra como «no disponible» registrando solo su nombre. Datos inventados (2027, FICTICIA-*).
import { Prisma, type PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ultimoPublicado = vi.hoisted(() => vi.fn());
const ultimoRechazado = vi.hoisted(() => vi.fn());
const leerConfigIa = vi.hoisted(() => vi.fn());
vi.mock("@/app/_comun/resumen-ia/publicado", () => ({ ultimoPublicadoDe: ultimoPublicado, ultimoRechazadoDe: ultimoRechazado }));
vi.mock("@/ia/config/leer", async (original) => ({ ...(await original<typeof import("@/ia/config/leer")>()), leerConfigIa }));

import { reiniciarMemoParaPruebas, resumenDelDia, TTL_MEMO_MS } from "@/app/_comun/resumen-ia/leer";
import { TEXTOS_RESUMEN_IA } from "@/app/_comun/resumen-ia/textos";
import { conTurno, reiniciarTurnoParaPruebas } from "@/app/proyecciones/turno";
import type { ResultadoExportacion } from "@/ia/evaluacion/exportar/exportar";
import { ErrorRegistro } from "@/ia/registro/fila";
import { paqueteFicticio, publicadoFicticio } from "./apoyo.ficticio";

const db = { soy: "la base" } as unknown as PrismaClient;
// 2027-03-17 a las 21:41 en Colombia: en UTC ya es el 18.
const AHORA = new Date("2027-03-18T02:41:13.457Z");
const HOY = new Date("2027-03-17T00:00:00.000Z");
const exportacion = (extra: Partial<ResultadoExportacion> = {}): ResultadoExportacion => ({
  paquetes: [paqueteFicticio("DIARIO"), paqueteFicticio("REGLAS"), paqueteFicticio("ESCENARIOS")], omitidos: [], avisos: [], ...extra,
});

let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  reiniciarMemoParaPruebas();
  reiniciarTurnoParaPruebas();
  ultimoPublicado.mockResolvedValue(null);
  ultimoRechazado.mockResolvedValue(null);
  leerConfigIa.mockResolvedValue(null);
  error = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  ultimoPublicado.mockReset();
  ultimoRechazado.mockReset();
  leerConfigIa.mockReset();
  vi.restoreAllMocks();
});

describe("resumenDelDia", () => {
  it("lee el último publicado (de cualquier día) y arma el de hoy con el export, con el día de Colombia a medianoche UTC", async () => {
    const paquetes = vi.fn().mockResolvedValue(exportacion());
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes });
    expect(ultimoPublicado).toHaveBeenCalledWith(db, "DIARIO");
    expect(paquetes).toHaveBeenCalledWith(db, HOY);
    expect(vista).toMatchObject({ tipo: "DIARIO", estado: "SIN_IA" });
  });

  it("con un publicado que pasa y el mismo paquete hoy: IA al día", async () => {
    ultimoPublicado.mockResolvedValue(publicadoFicticio(paqueteFicticio("REGLAS")));
    const vista = await resumenDelDia(db, "REGLAS", "u-ficticio", { ahora: AHORA, paquetes: vi.fn().mockResolvedValue(exportacion()) });
    expect(vista).toMatchObject({ estado: "IA", vigencia: "AL_DIA" });
  });

  it("un publicado que no pasa se descarta y se registra solo el código, nunca el texto", async () => {
    ultimoPublicado.mockResolvedValue(publicadoFicticio(paqueteFicticio("DIARIO"), { salidaModelo: "FICTICIA-ALFA no es json" }));
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: vi.fn().mockResolvedValue(exportacion()) });
    expect(vista.estado).toBe("SIN_IA");
    const lineas = error.mock.calls.map((c) => String(c[0]));
    expect(lineas.some((l) => l.includes("[resumen-ia]") && l.includes("SALIDA_INVALIDA"))).toBe(true);
    expect(lineas.join(" ")).not.toContain("FICTICIA");
  });

  it("el export se guarda un rato corto por día: las tres pantallas no repiten la proyección", async () => {
    const paquetes = vi.fn().mockResolvedValue(exportacion());
    await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes });
    await resumenDelDia(db, "ESCENARIOS", "u-ficticio", { ahora: new Date(AHORA.getTime() + TTL_MEMO_MS - 1), paquetes });
    expect(paquetes).toHaveBeenCalledTimes(1);
    await resumenDelDia(db, "REGLAS", "u-ficticio", { ahora: new Date(AHORA.getTime() + TTL_MEMO_MS), paquetes });
    expect(paquetes).toHaveBeenCalledTimes(2);
    expect(TTL_MEMO_MS).toBeLessThanOrEqual(60_000);
  });

  it("otro día no usa lo guardado", async () => {
    const paquetes = vi.fn().mockResolvedValue(exportacion());
    await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes });
    await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: new Date("2027-03-18T05:01:13.000Z"), paquetes });
    expect(paquetes).toHaveBeenCalledTimes(2);
    expect(paquetes).toHaveBeenLastCalledWith(db, new Date("2027-03-18T00:00:00.000Z"));
  });

  it("un tipo omitido por el export: no disponible por falta de datos", async () => {
    const paquetes = vi.fn().mockResolvedValue(exportacion({ paquetes: [paqueteFicticio("DIARIO")], omitidos: [{ tipo: "REGLAS", codigo: "SIN_PLAN_VIGENTE" }] }));
    const vista = await resumenDelDia(db, "REGLAS", "u-ficticio", { ahora: AHORA, paquetes });
    expect(vista).toMatchObject({ estado: "NO_DISPONIBLE", nota: TEXTOS_RESUMEN_IA.notaSinDatos });
  });

  it("sin turno (en vuelo): no se cae; el publicado sale sin comprobar", async () => {
    ultimoPublicado.mockResolvedValue(publicadoFicticio(paqueteFicticio("ESCENARIOS")));
    let soltar: () => void = () => undefined;
    const ocupado = conTurno("u-ficticio", AHORA.getTime(), () => new Promise<void>((r) => { soltar = r; }));
    const paquetes = vi.fn().mockResolvedValue(exportacion());
    const vista = await resumenDelDia(db, "ESCENARIOS", "u-ficticio", { ahora: AHORA, paquetes });
    soltar();
    await ocupado;
    expect(paquetes).not.toHaveBeenCalled();
    expect(vista).toMatchObject({ estado: "IA", vigencia: "SIN_COMPROBAR" });
  });

  it("sin turno y sin publicado: no disponible «en este momento»", async () => {
    let soltar: () => void = () => undefined;
    const ocupado = conTurno("u-ficticio", AHORA.getTime(), () => new Promise<void>((r) => { soltar = r; }));
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: vi.fn() });
    soltar();
    await ocupado;
    expect(vista).toMatchObject({ estado: "NO_DISPONIBLE", nota: TEXTOS_RESUMEN_IA.notaMomento });
  });

  it("un ErrorRegistro del publicado: se sigue sin él y se registra solo el código", async () => {
    ultimoPublicado.mockRejectedValue(new ErrorRegistro("GUARDADO_INVALIDO"));
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: vi.fn().mockResolvedValue(exportacion()) });
    expect(vista.estado).toBe("SIN_IA");
    expect(error.mock.calls.map((c) => String(c[0])).some((l) => l.includes("GUARDADO_INVALIDO"))).toBe(true);
  });

  it("un fallo de la base se propaga (la página muestra «No se pudo leer la base») y no queda guardado", async () => {
    const fallo = new Prisma.PrismaClientKnownRequestError("ficticio", { code: "P1001", clientVersion: "ficticio" });
    const paquetes = vi.fn().mockRejectedValueOnce(fallo).mockResolvedValue(exportacion());
    await expect(resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes })).rejects.toBe(fallo);
    await expect(resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes })).resolves.toMatchObject({ estado: "SIN_IA" });
    expect(paquetes).toHaveBeenCalledTimes(2);
  });

  it("otro error: no disponible, registrando solo su nombre", async () => {
    class ErrorFicticio extends Error { override name = "ErrorFicticio"; }
    const paquetes = vi.fn().mockRejectedValue(new ErrorFicticio("FICTICIA-ALFA 4613"));
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes });
    expect(vista).toMatchObject({ estado: "NO_DISPONIBLE", nota: TEXTOS_RESUMEN_IA.notaMomento });
    const lineas = error.mock.calls.map((c) => String(c[0])).join(" ");
    expect(lineas).toContain("ErrorFicticio");
    expect(lineas).not.toContain("FICTICIA-ALFA");
  });

  // Revisión (code-reviewer MEDIO 1): dos visitas a la vez comparten la corrida en vuelo.
  it("dos visitas a la vez (usuarios distintos) comparten una sola corrida del export", async () => {
    let soltar: (r: ResultadoExportacion) => void = () => undefined;
    const paquetes = vi.fn(() => new Promise<ResultadoExportacion>((r) => { soltar = r; }));
    const a = resumenDelDia(db, "DIARIO", "u-dueno", { ahora: AHORA, paquetes });
    const b = resumenDelDia(db, "REGLAS", "u-familiar", { ahora: AHORA, paquetes });
    await vi.waitFor(() => expect(paquetes).toHaveBeenCalled());
    soltar(exportacion());
    const [va, vb] = await Promise.all([a, b]);
    expect(paquetes).toHaveBeenCalledTimes(1);
    expect([va.estado, vb.estado]).toEqual(["SIN_IA", "SIN_IA"]);
  });

  it("el mismo usuario en dos pantallas a la vez: la segunda espera la corrida en vuelo, sin EN_VUELO", async () => {
    let soltar: (r: ResultadoExportacion) => void = () => undefined;
    const paquetes = vi.fn(() => new Promise<ResultadoExportacion>((r) => { soltar = r; }));
    const a = resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes });
    const b = resumenDelDia(db, "ESCENARIOS", "u-ficticio", { ahora: AHORA, paquetes });
    await vi.waitFor(() => expect(paquetes).toHaveBeenCalled());
    soltar(exportacion());
    expect((await b).estado).toBe("SIN_IA");
    expect((await a).estado).toBe("SIN_IA");
    expect(paquetes).toHaveBeenCalledTimes(1);
  });

  it("un reloj que vuelve atrás no usa lo guardado", async () => {
    const paquetes = vi.fn().mockResolvedValue(exportacion());
    await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes });
    await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: new Date(AHORA.getTime() - 1), paquetes });
    expect(paquetes).toHaveBeenCalledTimes(2);
  });

  // Revisión (code-reviewer MEDIO 2, security-reviewer BAJO 1): la tarjeta no tumba la página.
  it("un error inesperado al leer el publicado: la tarjeta sigue sin él, registrando solo el nombre", async () => {
    ultimoPublicado.mockRejectedValue(new TypeError("FICTICIA-ALFA 4613"));
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: vi.fn().mockResolvedValue(exportacion()) });
    expect(vista.estado).toBe("SIN_IA");
    const lineas = error.mock.calls.map((c) => String(c[0])).join(" ");
    expect(lineas).toContain("TypeError");
    expect(lineas).not.toContain("FICTICIA-ALFA");
  });

  it("un paquete que no es construido (el validador lanza): no disponible, no un 500", async () => {
    const roto = { ...paqueteFicticio("DIARIO") };
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: vi.fn().mockResolvedValue(exportacion({ paquetes: [roto] })) });
    expect(vista).toMatchObject({ estado: "NO_DISPONIBLE", nota: TEXTOS_RESUMEN_IA.notaMomento });
  });
});

describe("resumenDelDia · el botón «Analizar con IA» y el último rechazado", () => {
  const paquetes = () => vi.fn().mockResolvedValue(exportacion());
  const tareaOn = { activo: true, modeloLocal: "ficticio-modelo:7b" };
  const encendida = { modo: "local", analisisDemanda: true, tareas: { DIARIO: tareaOn, REGLAS: tareaOn, ESCENARIOS: tareaOn } };

  it("el dueño con el interruptor encendido: puedeAnalizar", async () => {
    leerConfigIa.mockResolvedValue(encendida);
    const vista = await resumenDelDia(db, "DIARIO", "u-dueno", { ahora: AHORA, paquetes: paquetes(), dueno: true });
    expect(vista.puedeAnalizar).toBe(true);
  });

  it("el interruptor apagado (el valor de omisión) o sin configuración: no hay botón (falla cerrada)", async () => {
    leerConfigIa.mockResolvedValue({ ...encendida, analisisDemanda: false });
    expect((await resumenDelDia(db, "DIARIO", "u-dueno", { ahora: AHORA, paquetes: paquetes(), dueno: true })).puedeAnalizar).toBe(false);
    leerConfigIa.mockResolvedValue(null);
    expect((await resumenDelDia(db, "DIARIO", "u-dueno", { ahora: AHORA, paquetes: paquetes(), dueno: true })).puedeAnalizar).toBe(false);
  });

  it("la familia (o sin decir quién es): nunca hay botón, aunque la configuración esté encendida", async () => {
    leerConfigIa.mockResolvedValue(encendida);
    expect((await resumenDelDia(db, "DIARIO", "u-familiar", { ahora: AHORA, paquetes: paquetes(), dueno: false })).puedeAnalizar).toBe(false);
    expect((await resumenDelDia(db, "DIARIO", "u-familiar", { ahora: AHORA, paquetes: paquetes() })).puedeAnalizar).toBe(false);
  });

  it("si leer la configuración falla (no es la base): sin botón, y la tarjeta sigue", async () => {
    leerConfigIa.mockRejectedValue(new TypeError("FICTICIA-ALFA 4613"));
    const vista = await resumenDelDia(db, "DIARIO", "u-dueno", { ahora: AHORA, paquetes: paquetes(), dueno: true });
    expect(vista).toMatchObject({ estado: "SIN_IA", puedeAnalizar: false });
    expect(error.mock.calls.map((c) => String(c[0])).join(" ")).not.toContain("FICTICIA-ALFA");
  });

  it("un fallo de la base al leer la configuración se propaga como los demás", async () => {
    const fallo = new Prisma.PrismaClientKnownRequestError("ficticio", { code: "P1001", clientVersion: "ficticio" });
    leerConfigIa.mockRejectedValue(fallo);
    await expect(resumenDelDia(db, "DIARIO", "u-dueno", { ahora: AHORA, paquetes: paquetes(), dueno: true })).rejects.toBe(fallo);
  });

  it("lee el último rechazado y lo pasa a la elección: con él, la vista trae el motivo en palabras simples", async () => {
    ultimoPublicado.mockResolvedValue(publicadoFicticio(paqueteFicticio("DIARIO")));
    ultimoRechazado.mockResolvedValue({ fechaNegocio: "2027-03-17", motivos: ["HECHO_NO_CITADO"], generadoEn: new Date("2027-03-18T00:05:00.000Z") });
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: paquetes() });
    expect(ultimoRechazado).toHaveBeenCalledWith(db, "DIARIO");
    expect(vista.rechazo).toContain("no citó todas las cifras que debía");
  });

  it("un error al leer el rechazado: se sigue sin él, registrando solo el nombre", async () => {
    ultimoRechazado.mockRejectedValue(new TypeError("FICTICIA-ALFA 4613"));
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: paquetes() });
    expect(vista).toMatchObject({ estado: "SIN_IA", rechazo: null });
    expect(error.mock.calls.map((c) => String(c[0])).join(" ")).not.toContain("FICTICIA-ALFA");
  });
});

describe("resumenDelDia · el motivo «IA apagada»", () => {
  const paquetes = () => vi.fn().mockResolvedValue(exportacion());
  const tareaOn = { activo: true, modeloLocal: "ficticio-modelo:7b" };
  const encendida = { modo: "local", analisisDemanda: true, tareas: { DIARIO: tareaOn, REGLAS: tareaOn, ESCENARIOS: tareaOn } };
  const apagada = [
    ["el modo está apagado", { ...encendida, modo: "apagado" }],
    ["el análisis a demanda está apagado", { ...encendida, analisisDemanda: false }],
    ["la tarea está inactiva", { ...encendida, tareas: { ...encendida.tareas, DIARIO: { activo: false, modeloLocal: null } } }],
    ["no hay configuración", null],
  ] as const;

  it.each(apagada)("sin publicado y %s: la vista trae «IA apagada», también para la familia", async (_c, config) => {
    leerConfigIa.mockResolvedValue(config);
    for (const dueno of [true, false]) {
      const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: paquetes(), dueno });
      expect(vista.sinIa).toBe(TEXTOS_RESUMEN_IA.iaApagada);
    }
    expect(TEXTOS_RESUMEN_IA.iaApagada).toBe("IA apagada");
  });

  it("también con la tarjeta «no disponible» (sin paquete de hoy)", async () => {
    leerConfigIa.mockResolvedValue({ ...encendida, modo: "apagado" });
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: vi.fn().mockResolvedValue(exportacion({ paquetes: [] })) });
    expect(vista).toMatchObject({ estado: "NO_DISPONIBLE", sinIa: "IA apagada" });
  });

  it("con todo encendido: sin motivo", async () => {
    leerConfigIa.mockResolvedValue(encendida);
    expect((await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: paquetes() })).sinIa).toBeNull();
  });

  it("con un publicado que se muestra, aunque la IA esté apagada: sin motivo (se ve el análisis)", async () => {
    leerConfigIa.mockResolvedValue({ ...encendida, modo: "apagado" });
    ultimoPublicado.mockResolvedValue(publicadoFicticio(paqueteFicticio("DIARIO")));
    expect((await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: paquetes() })).sinIa).toBeNull();
  });

  it("una tarea inactiva solo apaga SU tarjeta", async () => {
    leerConfigIa.mockResolvedValue({ ...encendida, tareas: { ...encendida.tareas, DIARIO: { activo: false, modeloLocal: null } } });
    expect((await resumenDelDia(db, "REGLAS", "u-ficticio", { ahora: AHORA, paquetes: paquetes() })).sinIa).toBeNull();
  });

  it("si leer la configuración falla (no es la base): no se afirma que esté apagada", async () => {
    leerConfigIa.mockRejectedValue(new TypeError("FICTICIA-ALFA 4613"));
    expect((await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: AHORA, paquetes: paquetes() })).sinIa).toBeNull();
  });
});
