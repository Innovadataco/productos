// «Qué movió su portafolio» (src/tablero/movimiento.ts): mismo par de ruedas para todas las especies.
// Datos inventados. Festivos de prueba: los del calendario de la BVC que caen en esas fechas.
import { describe, expect, it } from "vitest";
import { calcularTablero } from "@/tablero/calculo";
import { calcularMovimiento, calendarioDe, ruedaAnterior, type CalendarioBvc } from "@/tablero/movimiento";
import { D, dia, especie, punto } from "./ficticio";

const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
/** Lunes 11-ene-2027 (Reyes trasladado) y jueves/viernes santos de 2027 (25 y 26-mar). */
const FESTIVOS: ReadonlySet<string> = new Set(["2027-01-11", "2027-03-25", "2027-03-26"]);
/** Calendario de prueba: los años 2026-2028 están sembrados. */
const cal = (noHabiles: ReadonlySet<string>, anios: readonly number[] = [2026, 2027, 2028]): CalendarioBvc => ({ noHabiles, anios: new Set(anios) });
const SIN_FESTIVOS = cal(new Set());
const CON_FESTIVOS = cal(FESTIVOS);

const viva = (nemo: string, cantidad: bigint, serie: readonly (readonly [string, number])[]) => {
  const puntos = serie.map(([f, p]) => punto(f, p));
  const ultimo = puntos.at(-1);
  return especie({ nemotecnico: nemo, cantidad, costoVivo: D(1), serie: puntos, cierre: ultimo ? { ...ultimo, verificado: false } : null });
};
const filas = (...es: ReturnType<typeof viva>[]) => calcularTablero(es).filas;

describe("ruedaAnterior", () => {
  it.each([
    ["2027-11-19", "2027-11-18"], // viernes → jueves
    ["2027-11-22", "2027-11-19"], // lunes → viernes (salta el fin de semana)
    ["2027-01-12", "2027-01-08"], // martes → viernes (salta el lunes festivo)
    ["2027-03-29", "2027-03-24"], // lunes de Pascua → miércoles santo
  ])("%s → %s", (desde, esperado) => {
    expect(iso(ruedaAnterior(dia(desde), FESTIVOS))).toBe(esperado);
  });

  it("con un calendario corrupto (todo festivo) se rinde en vez de buscar para siempre", () => {
    const todo = new Set(Array.from({ length: 60 }, (_, k) => iso(new Date(dia("2027-11-19").getTime() - (k + 1) * 86_400_000))!));
    expect(ruedaAnterior(dia("2027-11-19"), todo)).toBeNull();
  });
});

describe("calcularMovimiento", () => {
  it("solo entran las especies cuyos dos últimos cierres son (rueda previa, referencia); las demás se cuentan", () => {
    const m = calcularMovimiento(filas(
      viva("FICT1", 10n, [["2027-10-28", 110], ["2027-10-29", 120]]), // ilíquida: periodo de octubre
      viva("FICT2", 5n, [["2027-11-18", 100], ["2027-11-19", 110]]),
      viva("FICT3", 7n, [["2027-11-16", 50], ["2027-11-19", 60]]), // no cerró el 19: su par abarca tres ruedas
    ), dia("2027-11-19"), SIN_FESTIVOS);
    expect([iso(m.previa), iso(m.referencia), m.motivo]).toEqual(["2027-11-18", "2027-11-19", null]);
    expect(m.especies.map((e) => [e.nemotecnico, e.aporte.toString(), e.variacionPct.toFixed(2)])).toEqual([["FICT2", "50", "10.00"]]);
    expect([m.neto?.toString(), m.omitidas]).toEqual(["50", 2]);
  });

  it("con el lunes festivo, el martes se compara contra el viernes", () => {
    const m = calcularMovimiento(filas(viva("FICT2", 5n, [["2027-01-08", 100], ["2027-01-12", 104]])), dia("2027-01-12"), CON_FESTIVOS);
    expect([iso(m.previa), m.neto?.toString(), m.omitidas]).toEqual(["2027-01-08", "20", 0]);
  });

  it.each([
    ["un sábado", "2027-11-20"],
    ["un festivo", "2027-01-11"],
  ])("si la referencia cae en %s no se compara: se omiten todas y se dice por qué", (_caso, ref) => {
    const m = calcularMovimiento(filas(viva("FICT2", 5n, [["2027-01-08", 100], [ref, 110]])), dia(ref), CON_FESTIVOS);
    expect([m.motivo, m.especies.length, m.neto, m.omitidas, m.previa]).toEqual(["REFERENCIA_NO_HABIL", 0, null, 1, null]);
  });

  it("una barra suelta en sábado entre las dos ruedas omite la especie", () => {
    const m = calcularMovimiento(filas(viva("FICT2", 5n, [["2027-11-19", 100], ["2027-11-20", 101], ["2027-11-22", 110]])), dia("2027-11-22"), SIN_FESTIVOS);
    expect([m.especies.length, m.omitidas, m.neto]).toEqual([0, 1, null]);
  });

  it("dos cierres con la misma fecha (dos fuentes) omiten la especie", () => {
    const m = calcularMovimiento(filas(viva("FICT2", 5n, [["2027-11-18", 100], ["2027-11-19", 110], ["2027-11-19", 111]])), dia("2027-11-19"), SIN_FESTIVOS);
    expect([m.especies.length, m.omitidas]).toEqual([0, 1]);
  });

  it("un solo cierre, o un precio anterior no positivo, omiten la especie (sin dividir por cero)", () => {
    const m = calcularMovimiento(filas(
      viva("FICT2", 5n, [["2027-11-19", 110]]),
      viva("FICT4", 5n, [["2027-11-18", 0], ["2027-11-19", 110]]),
    ), dia("2027-11-19"), SIN_FESTIVOS);
    expect([m.especies.length, m.omitidas, m.neto]).toEqual([0, 2, null]);
  });

  it("el neto es exacto en Decimal (sin errores de coma flotante)", () => {
    const m = calcularMovimiento(filas(
      viva("FICT2", 3n, [["2027-11-18", 20.1], ["2027-11-19", 20.3]]),
      viva("FICT4", 1n, [["2027-11-18", 0.3], ["2027-11-19", 0.1]]),
    ), dia("2027-11-19"), SIN_FESTIVOS);
    expect(m.especies.map((e) => e.aporte.toString())).toEqual(["0.6", "-0.2"]);
    expect(m.neto?.toString()).toBe("0.4");
  });

  it("ordena por el tamaño del aporte y desempata por nemotécnico", () => {
    const m = calcularMovimiento(filas(
      viva("FICTB", 1n, [["2027-11-18", 10], ["2027-11-19", 15]]),
      viva("FICTA", 1n, [["2027-11-18", 10], ["2027-11-19", 5]]),
      viva("FICTC", 1n, [["2027-11-18", 10], ["2027-11-19", 30]]),
    ), dia("2027-11-19"), SIN_FESTIVOS);
    expect(m.especies.map((e) => e.nemotecnico)).toEqual(["FICTC", "FICTA", "FICTB"]);
  });

  it("sin referencia (ninguna viva con cierre) no hay nada que comparar", () => {
    const m = calcularMovimiento(filas(viva("FICT2", 5n, [])), null, SIN_FESTIVOS);
    expect([m.motivo, m.neto, m.omitidas, m.referencia, m.previa]).toEqual(["SIN_CIERRES", null, 1, null, null]);
  });

  it("si el calendario no deja encontrar la rueda previa, se omiten todas y se dice por qué", () => {
    const todo = new Set(Array.from({ length: 60 }, (_, k) => iso(new Date(dia("2027-11-19").getTime() - (k + 1) * 86_400_000))!));
    const m = calcularMovimiento(filas(viva("FICT2", 5n, [["2027-11-18", 100], ["2027-11-19", 110]])), dia("2027-11-19"), cal(todo));
    expect([m.motivo, m.omitidas, m.neto]).toEqual(["SIN_RUEDA_PREVIA", 1, null]);
  });
});

describe("calendario de la BVC fuera de lo sembrado", () => {
  const fresca = (ref: string, previa: string) => filas(viva("FICT2", 5n, [[previa, 100], [ref, 110]]));

  it("si el año de la referencia no está sembrado no se compara: sus festivos serían invisibles", () => {
    const m = calcularMovimiento(fresca("2028-01-11", "2028-01-10"), dia("2028-01-11"), cal(new Set(), [2026, 2027]));
    expect([m.motivo, m.previa, m.neto, m.omitidas]).toEqual(["CALENDARIO_NO_CUBRE", null, null, 1]);
  });

  it("si la rueda previa cae en un año no sembrado (primer día hábil del año) tampoco se compara", () => {
    // El viernes 1-ene-2027 es festivo: la rueda previa del lunes 4 es el jueves 31-dic-2026, de un año sin sembrar.
    const m = calcularMovimiento(fresca("2027-01-04", "2026-12-31"), dia("2027-01-04"), cal(new Set(["2027-01-01"]), [2027]));
    expect([m.motivo, m.neto, m.omitidas]).toEqual(["CALENDARIO_NO_CUBRE", null, 1]);
  });

  it("calendarioDe arma los días no hábiles y los años sembrados desde las filas de calendario_bvc", () => {
    const c = calendarioDe([dia("2027-01-11"), dia("2028-01-10"), dia("2027-03-26")]);
    expect([...c.noHabiles].sort()).toEqual(["2027-01-11", "2027-03-26", "2028-01-10"]);
    expect([...c.anios].sort()).toEqual([2027, 2028]);
  });
});
