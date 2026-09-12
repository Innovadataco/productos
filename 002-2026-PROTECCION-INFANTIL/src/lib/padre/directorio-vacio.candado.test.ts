/**
 * SPEC-656 (I-387) · CANDADO de la clasificación del vacío del directorio.
 *
 * El defecto que cierra: con 0 verificados EN TOTAL, la pantalla decía «ningún
 * profesional coincide con los filtros» — culpaba la búsqueda del padre cuando el
 * problema es que no hay inventario. La conducta que se fija: **sin inventario, el
 * vacío es ESTRUCTURAL, nunca «por-filtro»**. Muere si alguien vuelve a mapear el
 * caso «0 verificados» a la salida que culpa la búsqueda.
 */
import { describe, it, expect } from "vitest";
import { clasificarVacioDirectorio } from "./directorio-vacio";

describe("SPEC-656 · clasificar el vacío del directorio", () => {
    it("0 en la lista y SIN inventario (0 verificados) → ESTRUCTURAL, jamás por-filtro", () => {
        expect(clasificarVacioDirectorio(0, false)).toBe("estructural");
        // el corazón del candado: el problema es nuestro, no la búsqueda del padre.
        expect(clasificarVacioDirectorio(0, false)).not.toBe("por-filtro");
    });

    it("0 en la lista pero SÍ hay inventario → por-filtro (ahí sí «amplía tu búsqueda»)", () => {
        expect(clasificarVacioDirectorio(0, true)).toBe("por-filtro");
    });

    it("hay resultados → con-resultados", () => {
        expect(clasificarVacioDirectorio(3, true)).toBe("con-resultados");
    });

    it("con resultados en mano, nunca inventa vacío aunque hayVerificados llegue en false", () => {
        // la lista presente es la verdad; el conteo total no la contradice.
        expect(clasificarVacioDirectorio(2, false)).toBe("con-resultados");
    });
});
