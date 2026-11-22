// Los datos de la página /proyecciones (frente proyecciones-pantalla) con las lecturas simuladas:
// - la historia: la evolución del tablero (el resumen ya leído) + el fondo por fecha, un punto por mes, hasta hoy;
//   si la evolución falla por un dato (no la base), la página sigue sin historia y se registra solo el nombre;
// - el cálculo inicial (5 años, sin aporte, reinvirtiendo, sin caída) bajo el MISMO turno que la API: ocupado, la
//   página sale sin resultado («OCUPADO») y el navegador lo pide; un error que no es de la base, «FALLO»;
// - `hoy` es la fecha de Colombia del servidor. Un fallo de la base se propaga (lo muestra la página). Inventado.
import { Prisma, type PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conTurno, reiniciarTurnoParaPruebas } from "@/app/proyecciones/turno";
import { aVistaProyeccion } from "@/app/proyecciones/vista";
import { resultadoFicticio } from "./ficticio";

const obtenerResumen = vi.hoisted(() => vi.fn());
const obtenerEvolucion = vi.hoisted(() => vi.fn());
const proyectar = vi.hoisted(() => vi.fn());
vi.mock("@/tablero/datos", () => ({ obtenerResumen }));
vi.mock("@/tablero/datos-evolucion", () => ({ obtenerEvolucion }));
vi.mock("@/proyecciones/proyectar", () => ({ proyectar }));

import { datosDeProyecciones } from "@/app/proyecciones/datos";

const D = (v: string) => new Prisma.Decimal(v);
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const AHORA = new Date("2027-03-17T15:41:00Z");
const movimientos = vi.fn();
const valores = vi.fn();
const db = { movimientoFondo: { findMany: movimientos }, valorUnidadFondo: { findMany: valores } } as unknown as PrismaClient;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  obtenerResumen.mockResolvedValue({ tablero: {} });
  obtenerEvolucion.mockResolvedValue({
    puntos: [
      { fecha: dia("2027-01-29"), valor: D("4701.13") },
      { fecha: dia("2027-02-26"), valor: D("4793.29") },
      { fecha: dia("2027-03-12"), valor: D("4811.47") },
    ],
  });
  movimientos.mockResolvedValue([
    { fondoId: "f1", fecha: dia("2027-01-05"), unidades: D("13.71"), tipo: "CONSTITUCION" },
    { fondoId: "f1", fecha: dia("2027-03-01"), unidades: D("2.37"), tipo: "RETIRO" },
  ]);
  valores.mockResolvedValue([{ fondoId: "f1", fechaValor: dia("2027-01-28"), valorUnidad: D("103.11") }, { fondoId: "f1", fechaValor: dia("2027-03-11"), valorUnidad: D("105.31") }]);
  proyectar.mockResolvedValue({ ok: true, resultado: resultadoFicticio() });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  [obtenerResumen, obtenerEvolucion, proyectar, movimientos, valores].forEach((f) => f.mockReset());
  reiniciarTurnoParaPruebas();
});

describe("datosDeProyecciones", () => {
  it("hoy en Colombia, la historia mensual con el fondo por fecha y el resultado inicial", async () => {
    const d = await datosDeProyecciones(db, "u-4613");
    expect(d.hoy).toBe("2027-03-17");
    expect(d.estado).toBe("LISTO");
    expect(d.inicial).toEqual(aVistaProyeccion(resultadoFicticio()));
    expect(d.historia.map((p) => p.dia)).toEqual(["2027-01-29", "2027-02-26", "2027-03-12"]);
    expect(d.historia[0]!.valor).toBeCloseTo(4701.13 + 13.71 * 103.11, 6);
    expect(d.historia[2]!.valor).toBeCloseTo(4811.47 + (13.71 - 2.37) * 105.31, 6);
  });

  it("la evolución usa el resumen del tablero ya leído; el fondo se lee hasta hoy, solo FIC y sin reemplazados", async () => {
    await datosDeProyecciones(db, "u-4613");
    expect(obtenerEvolucion).toHaveBeenCalledWith(db, { tablero: {} });
    const hoy = dia("2027-03-17");
    expect(movimientos.mock.calls[0]![0].where).toEqual({ fecha: { lte: hoy }, fondo: { tipo: "FIC" } });
    const w = valores.mock.calls[0]![0].where;
    expect(w.fondoId).toEqual({ in: ["f1"] });
    expect(w.reemplazadoEn).toBeNull();
    expect(w.fechaValor.lte).toEqual(hoy);
  });

  it("el cálculo inicial: 5 años, sin aporte, reinvirtiendo, sin caída, con trayectorias y semilla del servidor y sin `hoy`", async () => {
    await datosDeProyecciones(db, "u-4613");
    expect(proyectar).toHaveBeenCalledTimes(1);
    const [base, parametros, ...resto] = proyectar.mock.calls[0]!;
    expect(base).toBe(db);
    expect(parametros).toEqual({ horizonteMeses: 60, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0, trayectorias: 2000, semilla: expect.any(Number) });
    expect(resto).toEqual([]);
  });

  it("con el turno del usuario ocupado, sale sin resultado («OCUPADO») y con la historia", async () => {
    let soltar = () => undefined as void;
    const enVuelo = conTurno("u-4613", Date.now(), () => new Promise<void>((r) => { soltar = r; }));
    const d = await datosDeProyecciones(db, "u-4613");
    expect(d.estado).toBe("OCUPADO");
    expect(d.inicial).toBeNull();
    expect(d.historia).toHaveLength(3);
    soltar();
    await enVuelo;
  });

  it("si el cálculo falla por algo que no es la base: «FALLO» y el registro solo con el nombre", async () => {
    proyectar.mockRejectedValueOnce(new RangeError("FICTA 46137.41"));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = await datosDeProyecciones(db, "u-4613");
    expect(d.estado).toBe("FALLO");
    expect(d.inicial).toBeNull();
    expect(registro).toHaveBeenCalledWith("[proyecciones] no se pudo calcular (RangeError)");
  });

  it("si el motor rechaza los parámetros iniciales (no debería): «FALLO»", async () => {
    proyectar.mockResolvedValueOnce({ ok: false, errores: [{ campo: "trayectorias", codigo: "DEMASIADO_TRABAJO" }] });
    expect((await datosDeProyecciones(db, "u-4613")).estado).toBe("FALLO");
  });

  it("si la evolución falla por un dato: sin historia, el resto sigue y se registra solo el nombre", async () => {
    obtenerEvolucion.mockRejectedValueOnce(new TypeError("FICTA 4701.13"));
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = await datosDeProyecciones(db, "u-4613");
    expect(d.historia).toEqual([]);
    expect(d.estado).toBe("LISTO");
    expect(registro).toHaveBeenCalledWith("[proyecciones] no se pudo leer la historia (TypeError)");
  });

  it("un fallo de la base se propaga (en la historia o en el cálculo)", async () => {
    const caida = new Prisma.PrismaClientInitializationError("sin base", "5.22.0", "P1001");
    obtenerResumen.mockRejectedValueOnce(caida);
    await expect(datosDeProyecciones(db, "u-4613")).rejects.toBe(caida);
    proyectar.mockRejectedValueOnce(caida);
    await expect(datosDeProyecciones(db, "u-4613")).rejects.toBe(caida);
  });

  it("sin fondos con movimientos no consulta valores de unidad", async () => {
    movimientos.mockResolvedValueOnce([]);
    const d = await datosDeProyecciones(db, "u-4613");
    expect(valores).not.toHaveBeenCalled();
    expect(d.historia[0]!.valor).toBe(4701.13);
  });
});
