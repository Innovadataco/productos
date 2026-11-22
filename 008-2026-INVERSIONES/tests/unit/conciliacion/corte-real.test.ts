/**
 * Regla pura del corte real (frente certificacion-corte-real), la misma para la importación (señal 1) y para la
 * conciliación (fecha_corte_dudosa con el día sugerido): la certificación es la foto del cierre del día hábil
 * ANTERIOR al corte si
 * - hay al menos 2 especies COMPARABLES: valoración > 0 y cierre en el corte y en el día anterior (las demás no
 *   cuentan, p. ej. una que no negoció ese día; code-reviewer MEDIO: una sola no apaga la detección);
 * - todas las comparables cuadran con el cierre anterior (±1 %, la tolerancia de la verificación de precios);
 * - ninguna está más cerca del cierre del corte que del anterior;
 * - y al menos una NO cuadra con el cierre del corte.
 * Si no hay 2 comparables (falta un día entero, o casi), no concluye (null). Cifras inventadas, no redondas.
 */
import { describe, expect, it } from "vitest";
import { corteReal, type PreciosDeEspecie } from "@/conciliacion/corte-real";
import { TOLERANCIA_VERIFICACION } from "@/precios/guardar";

const e = (precioValoracion: string, cierre: string | null, cierreAnterior: string | null): PreciosDeEspecie => ({ precioValoracion, cierre, cierreAnterior });

describe("corteReal", () => {
  it("usa la tolerancia de la verificación de precios (1 %)", () => {
    expect(TOLERANCIA_VERIFICACION.toString()).toBe("0.01");
  });

  it("todas cuadran con el anterior y una no con el corte → cuenta especies y distintas", () => {
    expect(corteReal([e("2371", "2371", "2371"), e("63.17", "65.83", "63.17"), e("418.9", "431.07", "418.9")])).toEqual({ especies: 3, distintas: 2 });
  });

  it("la frontera del 1 % cuadra; un poco más ya no", () => {
    // pv 1237: 1 % = 12,37. 1249,37 está justo en el borde; 1249,38 se pasa.
    expect(corteReal([e("1237", "1283.41", "1249.37"), e("46.13", "47.91", "46.13")])).toEqual({ especies: 2, distintas: 2 });
    expect(corteReal([e("1237", "1283.41", "1249.38"), e("46.13", "47.91", "46.13")])).toBeNull();
  });

  it("si alguna está más cerca del cierre del corte que del anterior, no concluye (una certificación buena con una especie mal valorada)", () => {
    expect(corteReal([e("2371", "2371", "2389.13"), e("63.17", "65.83", "63.17")])).toBeNull();
  });

  it("si todas cuadran también con el corte, no concluye (nada distingue los dos días)", () => {
    expect(corteReal([e("2371", "2371", "2371"), e("63.17", "63.17", "63.17")])).toBeNull();
  });

  it("menos de 2 especies: no concluye", () => {
    expect(corteReal([e("63.17", "65.83", "63.17")])).toBeNull();
    expect(corteReal([])).toBeNull();
  });

  it("si quedan menos de 2 comparables (a las demás les falta un cierre): no concluye (no se puede saber)", () => {
    expect(corteReal([e("2371", null, "2371"), e("63.17", "65.83", "63.17")])).toBeNull();
    expect(corteReal([e("2371", "2399.4", null), e("63.17", "65.83", "63.17")])).toBeNull();
    expect(corteReal([e("2371", null, null), e("63.17", null, null), e("418.9", null, null)])).toBeNull();
  });

  it("una especie sin cierre en uno de los dos días no cuenta: con 2 comparables, concluye con ellas", () => {
    expect(corteReal([e("2371", null, "2371"), e("63.17", "65.83", "63.17"), e("418.9", "431.07", "418.9")])).toEqual({ especies: 2, distintas: 2 });
    expect(corteReal([e("2371", "2399.4", null), e("63.17", "65.83", "63.17"), e("418.9", "418.9", "418.9")])).toEqual({ especies: 2, distintas: 1 });
  });

  it("una valoración en 0 (o menos) no se compara: no cuenta", () => {
    expect(corteReal([e("0", "11.37", "0"), e("63.17", "65.83", "63.17")])).toBeNull();
    expect(corteReal([e("0", "11.37", "0"), e("63.17", "65.83", "63.17"), e("418.9", "418.9", "418.9")])).toEqual({ especies: 2, distintas: 1 });
  });
});
