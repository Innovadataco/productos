// INV-SPEC-16: no se guarda la barra de hoy antes de la hora definitiva (hora de Colombia). Datos inventados.
import { describe, expect, it } from "vitest";
import { HORA_BARRA_DEFINITIVA_COT, barraDefinitiva, fechaEnBogota } from "@/precios/horario";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
// Bogotá es UTC−5 todo el año: 15:00 COT = 20:00 UTC.
const cot = (a: number, m: number, d: number, h: number, min = 0, seg = 0) => new Date(Date.UTC(a, m - 1, d, h + 5, min, seg));
const sinFestivos: ReadonlySet<string> = new Set();

describe("barraDefinitiva", () => {
  it("la hora definitiva es una constante con nombre", () => {
    expect(HORA_BARRA_DEFINITIVA_COT).toEqual({ hora: 17, minuto: 0 });
  });
  it("una barra de un día anterior siempre es definitiva", () => {
    expect(barraDefinitiva(dia("2024-03-12"), cot(2024, 3, 13, 9), sinFestivos)).toBe(true);
  });
  it("la barra de hoy a las 16:59:59 no es definitiva", () => {
    expect(barraDefinitiva(dia("2024-03-13"), cot(2024, 3, 13, 16, 59, 59), sinFestivos)).toBe(false);
  });
  it("la barra de hoy a las 17:00 sí es definitiva", () => {
    expect(barraDefinitiva(dia("2024-03-13"), cot(2024, 3, 13, 17, 0), sinFestivos)).toBe(true);
  });
  it("usa la fecha de Colombia, no la UTC (22:00 COT ya es el día siguiente en UTC)", () => {
    const ahora = cot(2024, 3, 13, 22);
    expect(fechaEnBogota(ahora).toISOString()).toBe("2024-03-13T00:00:00.000Z");
    expect(barraDefinitiva(dia("2024-03-13"), ahora, sinFestivos)).toBe(true);
  });
  it("una barra de fecha futura no es definitiva", () => {
    expect(barraDefinitiva(dia("2024-03-14"), cot(2024, 3, 13, 20), sinFestivos)).toBe(false);
  });
  it("una barra fechada hoy en día no hábil (festivo o fin de semana) no es definitiva", () => {
    expect(barraDefinitiva(dia("2024-03-25"), cot(2024, 3, 25, 18), new Set(["2024-03-25"]))).toBe(false);
    expect(barraDefinitiva(dia("2024-03-16"), cot(2024, 3, 16, 18), sinFestivos)).toBe(false);
  });
  it("paso de medianoche en Colombia: 23:59:59 y 00:00 del día siguiente", () => {
    expect(barraDefinitiva(dia("2024-03-13"), cot(2024, 3, 13, 23, 59, 59), sinFestivos)).toBe(true);
    expect(barraDefinitiva(dia("2024-03-14"), cot(2024, 3, 13, 23, 59, 59), sinFestivos)).toBe(false);
    expect(barraDefinitiva(dia("2024-03-13"), cot(2024, 3, 14, 0, 0), sinFestivos)).toBe(true);
    expect(barraDefinitiva(dia("2024-03-14"), cot(2024, 3, 14, 0, 0), sinFestivos)).toBe(false);
  });
});
