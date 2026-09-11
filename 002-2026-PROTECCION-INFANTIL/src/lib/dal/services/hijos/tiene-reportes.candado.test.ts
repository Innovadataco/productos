/**
 * SPEC-660 (ola 2) · CANDADO de `marcarTieneReportes`.
 *
 * Vigila dos cosas que el rediseño del gráfico de hijos necesita duras:
 *  1. El CRITERIO — un identificador ACTIVO del hijo que coincide con el conjunto
 *     de «identificadores con reporte visible» (que la consulta arma con el MISMO
 *     criterio del aviso, `hijos/notificaciones.ts`). Un identificador apagado por
 *     el padre NO cuenta, aunque haya un reporte sobre ese valor.
 *  2. Que lo que sale es un BOOLEANO y NADA MÁS — nunca un conteo. Diseño prohibió
 *     números en el gráfico; devolver `personasIdentificadas`/`reportesAnonimos` acá
 *     sería dejarle a la pantalla el número que tiene prohibido mostrar, y al que
 *     llega en tres meses dos enteros para componer un «N personas». Los conteos
 *     (verificado ≠ anónimo, FORMA-SPEC666) viven en el detalle, aparte, post-SPEC-644.
 *
 * Muere por mutación: si el cruce deja de mirar `activo`, rojo; si el helper agrega
 * cualquier clave que no sea `tieneReportes`, rojo. Puro, sin BD → unit.
 */
import { describe, it, expect } from "vitest";
import { marcarTieneReportes } from "./hijos";

const hijo = (id: string, ids: { valor: string; activo: boolean }[]) => ({ id, identificadores: ids });

describe("SPEC-660 · marcarTieneReportes (booleano, no conteo)", () => {
    it("true cuando un identificador ACTIVO del hijo está en el conjunto con-reporte", () => {
        const out = marcarTieneReportes([hijo("h1", [{ valor: "+57300", activo: true }])], new Set(["+57300"]));
        expect(out[0].tieneReportes).toBe(true);
    });

    it("false cuando el identificador que coincide está INACTIVO (el apagado del padre pesa)", () => {
        const out = marcarTieneReportes([hijo("h1", [{ valor: "+57300", activo: false }])], new Set(["+57300"]));
        expect(out[0].tieneReportes).toBe(false);
    });

    it("false cuando ningún identificador activo del hijo coincide", () => {
        const out = marcarTieneReportes([hijo("h1", [{ valor: "+57300", activo: true }])], new Set(["@otro"]));
        expect(out[0].tieneReportes).toBe(false);
    });

    it("por hijo: cada uno se evalúa con SUS propios identificadores", () => {
        const out = marcarTieneReportes(
            [hijo("h1", [{ valor: "a", activo: true }]), hijo("h2", [{ valor: "b", activo: true }])],
            new Set(["a"]),
        );
        expect(out.map((h) => h.tieneReportes)).toEqual([true, false]);
    });

    it("conjunto vacío (el 0-de-hoy real en prod) → todos en calma, sin romperse", () => {
        const out = marcarTieneReportes(
            [hijo("h1", [{ valor: "a", activo: true }]), hijo("h2", [{ valor: "b", activo: true }])],
            new Set<string>(),
        );
        expect(out.every((h) => h.tieneReportes === false)).toBe(true);
    });

    it("ESTRUCTURAL: agrega SOLO `tieneReportes` (boolean) — jamás un conteo", () => {
        const entrada = hijo("h1", [{ valor: "a", activo: true }]);
        const out = marcarTieneReportes([entrada], new Set(["a"]));
        const clavesAgregadas = Object.keys(out[0]).filter((k) => !(k in entrada));
        expect(clavesAgregadas, "el gráfico no puede recibir un número que tiene prohibido mostrar").toEqual([
            "tieneReportes",
        ]);
        expect(typeof out[0].tieneReportes).toBe("boolean");
    });
});
