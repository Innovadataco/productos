// Candado del E2E de dato viejo (frente fuente-retraso): los cierres sembrados son de 2024 y el e2e espera el aviso
// exacto «dato de hace N días hábiles». Si el calendario sembrado no cubriera el año del reloj, el aviso pasaría a ser
// el aproximado y el e2e fallaría sin que nada haya cambiado. Por eso la siembra completa el calendario hasta el año del
// reloj más uno. Datos inventados.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aniosPorSembrar, filasDeCalendarioFaltantes } from "../../e2e/calendario-e2e";

const leer = (ruta: string) => readFileSync(new URL(`../../../${ruta}`, import.meta.url), "utf8");
const ahora = (iso: string) => new Date(`${iso}T15:00:00-05:00`);

describe("el calendario que siembra el E2E", () => {
  it("cubre el año del reloj y el siguiente: pide los que la base no trae", () => {
    expect(aniosPorSembrar(new Set([2022, 2024, 2025, 2026, 2027]), ahora("2026-11-26"))).toEqual([]);
    expect(aniosPorSembrar(new Set([2022, 2025, 2026, 2027]), ahora("2027-03-01"))).toEqual([2028]);
    expect(aniosPorSembrar(new Set([2026, 2027]), ahora("2028-02-01"))).toEqual([2028, 2029]);
  });

  it("usa el año de Colombia: a las 23:30 del 31-dic ya es ese año aunque en UTC sea el siguiente", () => {
    const finDeAnio = new Date("2028-01-01T04:30:00Z"); // 23:30 del 31-dic-2027 en Bogotá
    expect(aniosPorSembrar(new Set([2026, 2027]), finDeAnio)).toEqual([2028]);
  });

  it("cada año por sembrar lleva festivos fijos (1-ene y 25-dic) como no hábiles, para que el año cuente como cubierto", () => {
    const filas = filasDeCalendarioFaltantes(new Set([2026, 2027]), ahora("2028-02-01"));
    expect(filas.map((f) => f.dia.toISOString().slice(0, 10))).toEqual(["2028-01-01", "2028-12-25", "2029-01-01", "2029-12-25"]);
    for (const f of filas) expect(f.esHabil).toBe(false);
  });

  it("la siembra del E2E lo usa (si no, el candado no protege nada)", () => {
    expect(leer("tests/e2e/sembrar.ts")).toMatch(/filasDeCalendarioFaltantes/);
  });
});
