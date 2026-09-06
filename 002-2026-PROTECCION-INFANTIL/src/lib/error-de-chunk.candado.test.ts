/**
 * SPEC-548 (I-337) · CANDADO del detector de error de chunk (pieza pura).
 *
 * Muere con el defecto: si reconoce de MENOS, el caso (b) del despliegue se
 * escapa y la pantalla queda a medias; si reconoce de MÁS, un bug de lógica se
 * disfraza de «recargá» y se esconde. Por eso exige ambos bordes.
 *
 * Cae en integración por el glob src/** (no toca vitest.unit.includes.ts).
 */
import { describe, it, expect } from "vitest";
import { esErrorDeChunk } from "./error-de-chunk";

describe("SPEC-548 · esErrorDeChunk", () => {
    it("ChunkLoadError por name → true", () => {
        const e = new Error("x");
        e.name = "ChunkLoadError";
        expect(esErrorDeChunk(e)).toBe(true);
    });

    it("mensajes de import dinámico de los navegadores → true", () => {
        expect(esErrorDeChunk(new Error("Loading chunk 42 failed."))).toBe(true);
        expect(esErrorDeChunk(new Error("Loading CSS chunk 3 failed"))).toBe(true);
        expect(esErrorDeChunk(new Error("Failed to fetch dynamically imported module: /_next/x.js"))).toBe(true);
        expect(esErrorDeChunk(new Error("error loading dynamically imported module"))).toBe(true);
    });

    it("un error de lógica normal → false (no se disfraza de recargá)", () => {
        expect(esErrorDeChunk(new Error("Cannot read properties of undefined"))).toBe(false);
        expect(esErrorDeChunk(new TypeError("x is not a function"))).toBe(false);
    });

    it("nulo/indefinido → false", () => {
        expect(esErrorDeChunk(null)).toBe(false);
        expect(esErrorDeChunk(undefined)).toBe(false);
    });
});
