// Validación en el borde: lo que llega de los lectores se revisa antes de calcular. Puro.
import { describe, expect, it } from "vitest";
import { validarEntradas, validarPlan } from "@/analisis/validar";
import type { EntradasAnalisis, ReglaParaAnalisis } from "@/analisis/tipos";
import { calcularTablero } from "@/tablero/calculo";
import { accion, cerrada, D, dia, diasHabiles, entradaTablero, portafolio, serieDeRetornos } from "./fixtures/portafolio.ficticio";

const dias = diasHabiles("2019-01-02", 30);
const base = (): EntradasAnalisis => portafolio([{ id: "FICTICIA-A", cantidad: 37, cierres: serieDeRetornos(dias, 1237.4, Array(29).fill(0.0003)) }]);

describe("validarEntradas", () => {
  it("acepta las entradas bien armadas", () => {
    expect(() => validarEntradas(base())).not.toThrow();
  });

  it("hoy debe ser una fecha de negocio y la misma de la historia", () => {
    const e = base();
    expect(() => validarEntradas({ ...e, hoy: new Date(e.hoy.getTime() + 3_600_000) })).toThrow(RangeError);
    expect(() => validarEntradas({ ...e, historia: { ...e.historia, hoy: dia("2019-02-28") } })).toThrow(RangeError);
  });

  it("ningún cierre del tablero puede ser posterior a hoy", () => {
    const e = base();
    const futuro = { id: "FICTICIA-A", cantidad: 37, cierres: [], cierreTablero: { precio: D("1237.4"), fecha: dia("2021-12-01") } };
    expect(() => validarEntradas({ ...e, tablero: calcularTablero([entradaTablero(futuro)]) })).toThrow(RangeError);
    expect(() => validarEntradas({ ...e, tablero: calcularTablero([cerrada("FICTICIA-Z", { precio: D("1237.4"), fecha: dia("2021-12-01") })]) })).toThrow(RangeError);
  });

  it("un cierre del tablero con precio cero o negativo viola el contrato", () => {
    const e = base();
    const cero = { id: "FICTICIA-A", cantidad: 37, cierres: [], cierreTablero: { precio: D(0), fecha: dias[3]! } };
    expect(() => validarEntradas({ ...e, tablero: calcularTablero([entradaTablero(cero)]) })).toThrow(RangeError);
  });

  it("un precio infinito, o un valor de las acciones que no es la suma de las filas, violan el contrato", () => {
    const e = base();
    const infinito = { id: "FICTICIA-A", cantidad: 37, cierres: [], cierreTablero: { precio: D(Number.POSITIVE_INFINITY), fecha: dias[3]! } };
    expect(() => validarEntradas({ ...e, tablero: calcularTablero([entradaTablero(infinito)]) })).toThrow(RangeError);
    expect(() => validarEntradas({ ...e, tablero: { ...e.tablero, valorAcciones: e.tablero.valorAcciones.add("0.01") } })).toThrow(RangeError);
  });

  it("ni ids repetidos en el tablero ni en la historia", () => {
    const e = base();
    expect(() => validarEntradas({ ...e, tablero: { ...e.tablero, filas: [...e.tablero.filas, ...e.tablero.filas] } })).toThrow(RangeError);
    const a = accion("FICTICIA-A", 37, []);
    expect(() => validarEntradas({ ...e, historia: { ...e.historia, posiciones: [a, a] } })).toThrow(RangeError);
  });
});

describe("validarPlan", () => {
  const regla = (cambios: Partial<ReglaParaAnalisis> = {}): ReglaParaAnalisis => ({
    id: "FICTICIA-REGLA-1", instrumentoId: "FICTICIA-A", condicion: "CIERRE_BAJO", nivel: D("1237.4"), plazoHasta: dia("2021-07-19"), ...cambios,
  });

  it("acepta reglas bien armadas, con y sin plazo", () => {
    expect(() => validarPlan({ reglas: [regla(), regla({ id: "FICTICIA-REGLA-2", plazoHasta: null })] })).not.toThrow();
  });

  it("rechaza ids repetidos y un plazo que no es fecha de negocio", () => {
    expect(() => validarPlan({ reglas: [regla(), regla()] })).toThrow(RangeError);
    expect(() => validarPlan({ reglas: [regla({ plazoHasta: new Date("2021-07-19T05:00:00Z") })] })).toThrow(RangeError);
  });
});
