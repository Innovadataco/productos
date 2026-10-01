/**
 * SPEC-795 (PR 3) · Candado: `freemiumFechaFin` se calcula en UN SOLO lugar — LISTA BLANCA.
 *
 * Corre en el suite (unit, scan estático de archivos, sin base) Y cableado en arch:check (sección j).
 * El productor único es `calcularFreemiumFechaFin` (freemium-calculos.ts); toda ASIGNACIÓN del campo
 * cuyo lado derecho NO sea una forma autorizada (productor · re-lectura del valor · tipo/predicado
 * Prisma) es infractora. La lista blanca NO envejece con la próxima función de date-fns y caza la forma
 * de DOS líneas (`const fin = addDays(…)` → `freemiumFechaFin: fin`), que la lista negra dejaba pasar.
 */
import { describe, it, expect } from "vitest";
import { buscarInfractores, esLineaInfractora } from "./freemium-fecha-fin-chokepoint";

describe("SPEC-795 · candado freemiumFechaFin (lista blanca, productor único)", () => {
    it("ninguna asignación de freemiumFechaFin fuera de calcularFreemiumFechaFin", () => {
        expect(
            buscarInfractores().map((i) => `${i.archivo}:${i.linea}  ${i.texto}`),
            "Un sitio ASIGNA `freemiumFechaFin` desde algo que no es `calcularFreemiumFechaFin(...)` ni " +
                "una re-lectura del valor. Producí el valor con el productor único (freemium-calculos.ts).",
        ).toEqual([]);
    });

    it("control positivo: caza el inline (= y :), la forma de DOS líneas, y NO envejece", () => {
        // Inline, una línea (lo que ya cazaba la lista negra).
        expect(esLineaInfractora("const freemiumFechaFin = addDays(ahora, dias);")).toBe(true);
        expect(esLineaInfractora("    freemiumFechaFin: addMonths(base, 1),")).toBe(true);
        // DOS líneas: la 2da asigna el campo desde una variable pre-computada. La lista negra lo dejaba
        // pasar (esta línea no menciona aritmética); la lista blanca lo caza (`fin` no es productor ni lectura).
        expect(esLineaInfractora("    data: { freemiumFechaFin: fin },")).toBe(true);
        expect(esLineaInfractora("  freemiumFechaFin: finFreemium,")).toBe(true);
        // No envejece: una función de date-fns que nadie anticipó, o un cómputo a mano, también caen.
        expect(esLineaInfractora("const freemiumFechaFin = sub(hoy, { days: 1 });")).toBe(true);
        expect(esLineaInfractora("const freemiumFechaFin = new Date(x.getTime() + n);")).toBe(true);
        // Un cómputo que ENVUELVE una lectura del campo tampoco pasa (empieza por la función).
        expect(esLineaInfractora("    freemiumFechaFin: addMonths(prev.freemiumFechaFin, 1),")).toBe(true);
    });

    it("control negativo: NO marca el productor, ni la re-lectura, ni tipos/predicados Prisma", () => {
        // (1) productor único (con y sin await).
        expect(esLineaInfractora("const freemiumFechaFin = calcularFreemiumFechaFin(ahora, dias);")).toBe(false);
        expect(esLineaInfractora("    freemiumFechaFin = await calcularFreemiumFechaFin(a, d);")).toBe(false);
        // (2) re-lectura / serialización del valor ya calculado.
        expect(esLineaInfractora("const fin = suscripcion.freemiumFechaFin;")).toBe(false); // sin `=`/`:` tras el campo
        expect(esLineaInfractora("        freemiumFechaFin: freemiumFechaFin.toISOString(),")).toBe(false);
        expect(esLineaInfractora("        freemiumFechaFin: resultado.freemiumFechaFin.toISOString(),")).toBe(false);
        expect(esLineaInfractora("        freemiumFechaFin: suscripcion.freemiumFechaFin?.toISOString() ?? null,")).toBe(false);
        // (3a) anotación de tipo (y NO confundir con `Date.now()`, que es un valor).
        expect(esLineaInfractora("    freemiumFechaFin: Date;")).toBe(false);
        expect(esLineaInfractora("    freemiumFechaFin: Date | null;")).toBe(false);
        expect(esLineaInfractora("    let freemiumFechaFin: Date | null = null;")).toBe(false);
        expect(esLineaInfractora("    freemiumFechaFin: string | null;")).toBe(false);
        expect(esLineaInfractora("const freemiumFechaFin = Date.now();")).toBe(true); // valor, no tipo → infractor
        // (3b) predicado / selector / orden de Prisma.
        expect(esLineaInfractora("            freemiumFechaFin: { lt: limiteUtc },")).toBe(false);
        expect(esLineaInfractora("            where: { freemiumFechaFin: { not: null } },")).toBe(false);
        expect(esLineaInfractora("                freemiumFechaFin: true,")).toBe(false);
        expect(esLineaInfractora('            orderBy: { freemiumFechaFin: "asc" },')).toBe(false);
        // Acceso/ternaria: el campo precedido por `.` no es una asignación del campo.
        expect(esLineaInfractora("const base = x.freemiumFechaFin > y ? x.freemiumFechaFin : y;")).toBe(false);
    });
});
