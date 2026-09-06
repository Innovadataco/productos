/**
 * SPEC-548 (I-337) · CANDADO del motor de detección de versión (pieza pura).
 *
 * Vigila la CONDUCTA de `hayVersionNueva`: dispara SOLO con evidencia positiva
 * de cambio (dos sellos con sha real y distintos). Muere con el defecto —
 * invertir la comparación o volverla constante deja pasar un cambio o inventa uno.
 *
 * Cae en integración por el glob src/** (no toca vitest.unit.includes.ts): es
 * puro, no necesita el shard unit.
 */
import { describe, it, expect } from "vitest";
import { hayVersionNueva } from "./version-cliente";

const A = { version: "1.0.0", sha: "aaaa111" };
const B = { version: "1.0.0", sha: "bbbb222" };

describe("SPEC-548 · hayVersionNueva", () => {
    it("mismo sha → NO hay versión nueva", () => {
        expect(hayVersionNueva(A, { ...A })).toBe(false);
    });

    it("sha distinto → SÍ hay versión nueva", () => {
        expect(hayVersionNueva(A, B)).toBe(true);
    });

    it("sin sello (cargado o actual null) → false, nunca afirma", () => {
        expect(hayVersionNueva(null, B)).toBe(false);
        expect(hayVersionNueva(A, null)).toBe(false);
    });

    it("sello a medias (sha null, típico dev) → false, no molesta", () => {
        expect(hayVersionNueva({ version: "1.0.0", sha: null }, B)).toBe(false);
        expect(hayVersionNueva(A, { version: "2.0.0", sha: null })).toBe(false);
    });
});
