/**
 * SPEC-795 (PR 3) · Candado: `freemiumFechaFin` se calcula en UN SOLO lugar.
 *
 * Corre en el suite (unit, scan estático de archivos, sin base) Y está cableado en arch:check (sección
 * j). El productor único es `calcularFreemiumFechaFin` (freemium-calculos.ts); cualquier otro sitio que
 * ASIGNE `freemiumFechaFin` con aritmética de fecha cruda (addDays/addMonths/setMonth) lo pone rojo.
 *
 * El defecto que cierra (medido en PROD, 8 filas reales 5h cortas): `freemium-activacion` sumaba el
 * campo INLINE con addDays sobre `ahoraBogota()`. SPEC-794 arregló la función equivocada porque se
 * barrieron los LLAMADORES, no los ESCRITORES DEL CAMPO. Este candado hace el inline IMPOSIBLE.
 */
import { describe, it, expect } from "vitest";
import { buscarInfractores, PATRON_INLINE } from "./freemium-fecha-fin-chokepoint";

describe("SPEC-795 · candado freemiumFechaFin (productor único)", () => {
    it("cero cálculos inline de freemiumFechaFin fuera de calcularFreemiumFechaFin", () => {
        expect(
            buscarInfractores().map((i) => `${i.archivo}:${i.linea}  ${i.texto}`),
            "Un sitio ASIGNA `freemiumFechaFin` con aritmética de fecha cruda (addDays/addMonths/setMonth) " +
                "en vez de usar `calcularFreemiumFechaFin` (freemium-calculos.ts, día calendario Bogotá). " +
                "Reemplazá el cálculo inline por el productor único.",
        ).toEqual([]);
    });

    // Control positivo de la SONDA: el regex DEBE pegar en las formas prohibidas y NO pegar ni en la
    // asignación autorizada ni en la LECTURA del campo. Si una «mejora» aflojara el patrón, estos
    // asertos se ponen rojos antes de que el candado quede ciego.
    it("control positivo: el patrón caza el cálculo inline (con = y con :) y perdona al productor y a la lectura", () => {
        expect(PATRON_INLINE.test("const freemiumFechaFin = addDays(ahora, dias);")).toBe(true);
        expect(PATRON_INLINE.test("const freemiumFechaFin = addMonths(base, 1);")).toBe(true);
        expect(PATRON_INLINE.test("    freemiumFechaFin: setMonth(d, m),")).toBe(true);
        // Autorizado: asignar desde el productor único NO matchea.
        expect(PATRON_INLINE.test("const freemiumFechaFin = calcularFreemiumFechaFin(ahora, dias);")).toBe(false);
        // Leer el campo NO matchea (solo el cálculo).
        expect(PATRON_INLINE.test("const fin = suscripcion.freemiumFechaFin;")).toBe(false);
        expect(PATRON_INLINE.test("freemiumFechaFin: freemiumFechaFin.toISOString(),")).toBe(false);
    });
});
