// El camino ÚNICO de escritura de las series oficiales (src/datos-oficiales/series/guardar.ts) contra una base falsa
// que imita el índice único parcial (P2002) y la exclusión de vigencias (23P01): reimportar no escribe nada; una
// revisión retira los vigentes que se solapan e inserta en la misma transacción; el lote se alarga para no partir un
// vigente; los choques con otra corrida (P2002, 23P01, P2034 o el retiro que ya hizo otra) se reintentan releyendo; un
// lote que falla detiene su serie (las demás siguen); nunca se muestra el mensaje de un error. Cifras inventadas.
import { describe, expect, it } from "vitest";
import {
  ESPERA_MAXIMA_TX_SERIES_MS, MAX_INTENTOS_SERIES, MAX_VUELTAS_LOTE, TAMANO_LOTE_SERIES, TIEMPO_MAXIMO_LOTE_SERIES_MS, guardarSeries,
  type SerieAGuardar,
} from "@/datos-oficiales/series/guardar";
import { baseFalsaSeries, error23P01, errorConocido, errorP2002, type FilaSerieFalsa } from "./base-falsa-series";

const DIA_MS = 86_400_000;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const masDias = (d: Date, n: number) => new Date(d.getTime() + n * DIA_MS);
const fila = (desde: string, hasta: string, valor: string) => ({ desde: dia(desde), hasta: dia(hasta), valor });
const serie = (valores: SerieAGuardar["valores"], codigo = "FICTA", fuente = "sfc:x"): SerieAGuardar => ({ codigo, fuente, valores });
/** `cuantos` días seguidos desde `inicio`, de un día cada uno, con un valor que se puede cambiar por índice. */
const diarios = (inicio: string, cuantos: number, valor: (i: number) => string = () => "7.13") =>
  Array.from({ length: cuantos }, (_, i) => ({ desde: masDias(dia(inicio), i), hasta: masDias(dia(inicio), i), valor: valor(i) }));

describe("guardarSeries · lo que escribe", () => {
  it("una serie nueva: inserta todo en una transacción con la serie, la vigencia, el valor y la fuente (la hora la pone la base)", async () => {
    const b = baseFalsaSeries();
    const [r] = await guardarSeries(b.db, [serie([fila("2027-03-05", "2027-03-07", "4613.27"), fila("2027-03-08", "2027-03-08", "4613.29")])]);
    expect(r).toEqual({ codigo: "FICTA", filas: 2, nuevas: 2, revisadas: 0, retiradas: 0, sinCambios: 0, diasDescubiertos: 0, ultimoHasta: dia("2027-03-08"), fallo: null });
    expect(b.llamadas.transacciones).toBe(1);
    expect(b.llamadas.opcionesTx).toEqual([{ timeout: TIEMPO_MAXIMO_LOTE_SERIES_MS, maxWait: ESPERA_MAXIMA_TX_SERIES_MS }]);
    expect(b.llamadas.creadas[0]!.map((d) => [d.serie, iso(d.desde), iso(d.hasta), d.valor.toString(), d.fuente, Object.keys(d).sort().join()])).toEqual([
      ["FICTA", "2027-03-05", "2027-03-07", "4613.27", "sfc:x", "desde,fuente,hasta,serie,valor"],
      ["FICTA", "2027-03-08", "2027-03-08", "4613.29", "sfc:x", "desde,fuente,hasta,serie,valor"],
    ]);
  });

  it("reimportar lo mismo no escribe nada (ni retiro ni inserción), aunque la base guarde otra escala u otra fuente", async () => {
    const b = baseFalsaSeries({ previas: [
      { serie: "FICTA", desde: "2027-03-05", hasta: "2027-03-07", valor: "4613.270" },
      { serie: "FICTA", desde: "2027-03-08", hasta: "2027-03-08", valor: "4613.29", fuente: "sfc:otra" },
    ] });
    const [r] = await guardarSeries(b.db, [serie([fila("2027-03-05", "2027-03-07", "4613.27"), fila("2027-03-08", "2027-03-08", "4613.29")])]);
    expect(r).toMatchObject({ nuevas: 0, revisadas: 0, retiradas: 0, sinCambios: 2, fallo: null });
    expect([b.llamadas.creadas, b.llamadas.retiros, b.llamadas.intentosCrear]).toEqual([[], [], 0]);
  });

  it("una revisión retira con guarda los vigentes que se solapan e inserta en la misma transacción; los días que quedan sin vigente se cuentan", async () => {
    const b = baseFalsaSeries({ previas: [{ serie: "FICTA", desde: "2027-03-05", hasta: "2027-03-07", valor: "4613.27" }, { serie: "FICTB", desde: "2027-03-05", hasta: "2027-03-05", valor: "9.37" }] });
    const [r] = await guardarSeries(b.db, [serie([fila("2027-03-05", "2027-03-05", "4613.31")])]);
    expect(r).toMatchObject({ nuevas: 0, revisadas: 1, retiradas: 1, sinCambios: 0, diasDescubiertos: 2, ultimoHasta: dia("2027-03-05"), fallo: null });
    expect(b.llamadas.transacciones).toBe(1);
    expect(b.llamadas.retiros[0]!.where).toEqual({ id: { in: ["f00001"] }, reemplazadoEn: null });
    expect(b.filas()).toEqual([
      ["FICTA", "2027-03-05", "2027-03-07", "4613.27", false], ["FICTB", "2027-03-05", "2027-03-05", "9.37", true], ["FICTA", "2027-03-05", "2027-03-05", "4613.31", true],
    ]);
  });

  it("cada lote toma primero el candado de su serie (pg_advisory_xact_lock): dos corridas de la misma serie no se cruzan (database-reviewer, MEDIO)", async () => {
    const b = baseFalsaSeries({ previas: [{ serie: "FICTA", desde: "2021-01-01", hasta: "2021-01-01", valor: "7.11" }] });
    await guardarSeries(b.db, [serie(diarios("2021-01-01", TAMANO_LOTE_SERIES + 2)), serie([fila("2027-03-08", "2027-03-08", "9.37")], "FICTB")]);
    expect(b.llamadas.candados).toEqual(["008:serie-oficial:FICTA", "008:serie-oficial:FICTA", "008:serie-oficial:FICTB"]);
    expect(b.llamadas.orden).toEqual(["candado", "leer", "retirar", "crear", "candado", "leer", "crear", "candado", "leer", "crear"]);
  });

  it("lee los vigentes en la ventana justa: desde entre el primer desde − 31 días y el último hasta, y hasta desde el primer desde", async () => {
    const b = baseFalsaSeries();
    await guardarSeries(b.db, [serie([fila("2027-03-08", "2027-03-08", "9.37"), fila("2027-03-05", "2027-03-07", "9.41")])]);
    expect(b.llamadas.lecturas).toEqual([{ serie: "FICTA", reemplazadoEn: null, desde: { gte: dia("2027-02-02"), lte: dia("2027-03-08") }, hasta: { gte: dia("2027-03-05") } }]);
  });

  it(`por lotes de ${TAMANO_LOTE_SERIES} filas, cada uno en su transacción, en orden de desde`, async () => {
    const b = baseFalsaSeries();
    const [r] = await guardarSeries(b.db, [serie(diarios("2021-01-01", 2 * TAMANO_LOTE_SERIES + 7).reverse())]);
    expect(r).toMatchObject({ filas: 2 * TAMANO_LOTE_SERIES + 7, nuevas: 2 * TAMANO_LOTE_SERIES + 7, fallo: null });
    expect(b.llamadas.creadas.map((c) => c.length)).toEqual([TAMANO_LOTE_SERIES, TAMANO_LOTE_SERIES, 7]);
    expect(iso(b.llamadas.creadas[0]![0]!.desde)).toBe("2021-01-01");
  });

  it("un vigente retirado que pasa del corte alarga el lote: su retiro y todas sus filas van en la misma transacción", async () => {
    const corte = masDias(dia("2021-01-01"), TAMANO_LOTE_SERIES - 1);
    const b = baseFalsaSeries({ previas: [{ serie: "FICTA", desde: iso(corte), hasta: iso(masDias(corte, 2)), valor: "7.13" }] });
    const [r] = await guardarSeries(b.db, [serie(diarios("2021-01-01", TAMANO_LOTE_SERIES + 5))]);
    expect(r).toMatchObject({ nuevas: TAMANO_LOTE_SERIES + 2, revisadas: 3, retiradas: 1, diasDescubiertos: 0, fallo: null });
    expect(b.llamadas.creadas.map((c) => c.length)).toEqual([TAMANO_LOTE_SERIES + 2, 3]);
    expect(b.llamadas.transacciones).toBe(2);
  });

  it(`si alargar el lote no encuentra corte en ${MAX_VUELTAS_LOTE} vueltas, no escribe ese lote y la serie sale con GUARDADO_ERROR`, async () => {
    // Filas de 2 días [0-1], [2-3]… sobre vigentes de 2 días corridos uno, [1-2], [3-4]…: cada vuelta encuentra otro.
    const inicio = dia("2021-01-01");
    const filas = Array.from({ length: TAMANO_LOTE_SERIES + 2 * MAX_VUELTAS_LOTE }, (_, i) => ({ desde: masDias(inicio, 2 * i), hasta: masDias(inicio, 2 * i + 1), valor: "7.13" }));
    const previas = Array.from({ length: TAMANO_LOTE_SERIES + 2 * MAX_VUELTAS_LOTE }, (_, i) => ({ serie: "FICTA", desde: iso(masDias(inicio, 2 * i + 1)), hasta: iso(masDias(inicio, 2 * i + 2)), valor: "7.13" }));
    const b = baseFalsaSeries({ previas });
    const [r] = await guardarSeries(b.db, [serie(filas)]);
    expect(r).toMatchObject({ nuevas: 0, revisadas: 0, retiradas: 0, fallo: { codigo: "GUARDADO_ERROR", detalle: "LoteSinCorte", sinGuardar: filas.length } });
    expect(b.llamadas.creadas).toEqual([]);
  });
});

describe("guardarSeries · choques con otra corrida", () => {
  it.each([
    ["P2002 (el índice único parcial)", errorP2002],
    ["23P01 (la exclusión, que Prisma entrega sin código)", error23P01],
    ["P2034 (conflicto de escritura o bloqueo mutuo)", () => errorConocido("P2034")],
  ])("%s: se deshace el lote y se reintenta releyendo", async (_, error) => {
    const b = baseFalsaSeries({ fallosCrear: [error()] });
    const [r] = await guardarSeries(b.db, [serie([fila("2027-03-08", "2027-03-08", "9.37")])]);
    expect(r).toMatchObject({ nuevas: 1, fallo: null });
    expect([b.llamadas.transacciones, b.llamadas.intentosCrear]).toEqual([2, 2]);
    expect(b.filas()).toEqual([["FICTA", "2027-03-08", "2027-03-08", "9.37", true]]);
  });

  it("un choque en el retiro (P2034) también se reintenta, y lo retirado en el intento fallido se deshace (code-reviewer, BAJO)", async () => {
    const b = baseFalsaSeries({ previas: [{ serie: "FICTA", desde: "2027-03-08", hasta: "2027-03-08", valor: "9.37" }], fallosRetirar: [errorConocido("P2034")] });
    const [r] = await guardarSeries(b.db, [serie([fila("2027-03-08", "2027-03-08", "9.41")])]);
    expect(r).toMatchObject({ revisadas: 1, retiradas: 1, fallo: null });
    expect(b.llamadas.transacciones).toBe(2);
    expect(b.filas()).toEqual([["FICTA", "2027-03-08", "2027-03-08", "9.37", false], ["FICTA", "2027-03-08", "2027-03-08", "9.41", true]]);
  });

  it("un choque después de alargar el lote: se reintenta el lote entero, alargado otra vez", async () => {
    const corte = masDias(dia("2021-01-01"), TAMANO_LOTE_SERIES - 1);
    const b = baseFalsaSeries({ previas: [{ serie: "FICTA", desde: iso(corte), hasta: iso(masDias(corte, 2)), valor: "7.13" }], fallosCrear: [error23P01()] });
    const [r] = await guardarSeries(b.db, [serie(diarios("2021-01-01", TAMANO_LOTE_SERIES + 5))]);
    expect(r).toMatchObject({ nuevas: TAMANO_LOTE_SERIES + 2, revisadas: 3, retiradas: 1, fallo: null });
    expect(b.llamadas.creadas.map((c) => c.length)).toEqual([TAMANO_LOTE_SERIES + 2, 3]);
    expect(b.llamadas.transacciones).toBe(3);
  });

  it("otra corrida ya retiró el vigente (el retiro cuenta menos): se relee y lo que la otra guardó igual queda sin cambios", async () => {
    const otra = (filas: FilaSerieFalsa[], n: number) => {
      if (n > 0) return;
      const viejo = filas.find((f) => f.reemplazadoEn === null)!;
      viejo.reemplazadoEn = new Date("2021-01-04T00:00:00Z");
      filas.push({ ...viejo, id: "otra", valor: viejo.valor.plus("0.04"), reemplazadoEn: null });
    };
    const b = baseFalsaSeries({ previas: [{ serie: "FICTA", desde: "2027-03-08", hasta: "2027-03-08", valor: "9.37" }], antesDeRetirar: otra });
    const [r] = await guardarSeries(b.db, [serie([fila("2027-03-08", "2027-03-08", "9.41")])]);
    expect(r).toMatchObject({ nuevas: 0, revisadas: 0, retiradas: 0, sinCambios: 1, fallo: null });
    expect(b.llamadas.transacciones).toBe(2);
  });

  it(`a los ${MAX_INTENTOS_SERIES} intentos se rinde: GUARDADO_ERROR con nombre y código del error, nunca su mensaje, y no escribe nada`, async () => {
    const b = baseFalsaSeries({ falloSiempre: { serie: "FICTA", error: error23P01 } });
    const [r] = await guardarSeries(b.db, [serie([fila("2027-03-08", "2027-03-08", "9.37")])]);
    expect(r).toMatchObject({ nuevas: 0, fallo: { codigo: "GUARDADO_ERROR", detalle: "PrismaClientUnknownRequestError", sinGuardar: 1 } });
    expect(b.llamadas.intentosCrear).toBe(MAX_INTENTOS_SERIES);
    expect(JSON.stringify(r)).not.toMatch(/23P01|Key|FICTA,|2027-03-05|sin_solape/);
    expect(b.filas()).toEqual([]);
  });

  it("un fallo que no es un choque (P2028, la transacción) no se reintenta", async () => {
    const b = baseFalsaSeries({ falloSiempre: { serie: "FICTA", error: () => errorConocido("P2028") } });
    const [r] = await guardarSeries(b.db, [serie([fila("2027-03-08", "2027-03-08", "9.37")])]);
    expect(r?.fallo).toEqual({ codigo: "GUARDADO_ERROR", detalle: "PrismaClientKnownRequestError P2028", sinGuardar: 1 });
    expect(b.llamadas.intentosCrear).toBe(1);
    expect(JSON.stringify(r)).not.toContain("4613.27");
  });

  it("un error que no es de Prisma ni un Error: «error», sin reintento", async () => {
    const b = baseFalsaSeries({ fallosCrear: [Object.assign(new Error("con 4613.27"), { name: "TypeError" })] });
    const [r] = await guardarSeries(b.db, [serie([fila("2027-03-08", "2027-03-08", "9.37")])]);
    expect(r?.fallo).toEqual({ codigo: "GUARDADO_ERROR", detalle: "TypeError", sinGuardar: 1 });
  });
});

describe("guardarSeries · un lote que falla", () => {
  it("detiene su serie (no deja un vigente retirado sin su reemplazo) y las demás series siguen", async () => {
    const b = baseFalsaSeries({ falloSiempre: { serie: "FICTB", error: () => errorConocido("P2028") } });
    const r = await guardarSeries(b.db, [serie(diarios("2021-01-01", 3), "FICTB"), serie(diarios("2021-01-01", 2), "FICTA")]);
    expect(r.map((x) => [x.codigo, x.nuevas, x.fallo?.sinGuardar ?? 0])).toEqual([["FICTB", 0, 3], ["FICTA", 2, 0]]);
  });

  it("los lotes ya guardados quedan; los que siguen al que falla no se intentan", async () => {
    const b = baseFalsaSeries({ fallosCrear: [undefined, errorConocido("P2028")] });
    const [r] = await guardarSeries(b.db, [serie(diarios("2021-01-01", 2 * TAMANO_LOTE_SERIES + 3))]);
    expect(r).toMatchObject({ nuevas: TAMANO_LOTE_SERIES, fallo: { codigo: "GUARDADO_ERROR", sinGuardar: TAMANO_LOTE_SERIES + 3 } });
    expect(b.filas()).toHaveLength(TAMANO_LOTE_SERIES);
    expect(b.llamadas.intentosCrear).toBe(2);
  });

  it("si falla leer el último vigente, la serie sale con BASE_ERROR (lo guardado queda)", async () => {
    const b = baseFalsaSeries({ errorUltimo: errorConocido("P1001") });
    const [r] = await guardarSeries(b.db, [serie([fila("2027-03-08", "2027-03-08", "9.37")])]);
    expect(r).toMatchObject({ nuevas: 1, ultimoHasta: null, fallo: { codigo: "BASE_ERROR", detalle: "PrismaClientKnownRequestError P1001", sinGuardar: 0 } });
  });

  it("una serie sin filas no abre transacciones", async () => {
    const b = baseFalsaSeries();
    const [r] = await guardarSeries(b.db, [serie([])]);
    expect(r).toMatchObject({ filas: 0, nuevas: 0, fallo: null, ultimoHasta: null });
    expect(b.llamadas.transacciones).toBe(0);
  });
});
