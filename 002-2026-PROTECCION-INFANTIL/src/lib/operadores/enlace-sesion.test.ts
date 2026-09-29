/**
 * SPEC-750 · unit de la regla PURA del enlace: validación (https/no-HTML). Sin BD.
 * (SPEC-778 eliminó `enlaceVisibleParaCita` y su test: la visibilidad se deriva de
 * `estadoEfectivoDeCita` (746) en `enlace-derivado.ts`, con su propio candado.)
 */
import { describe, it, expect } from "vitest";
import { validarEnlaceReunion } from "./enlace-validacion";

describe("validarEnlaceReunion · solo https, jamás HTML", () => {
    it("acepta un https válido", () => {
        expect(validarEnlaceReunion("https://meet.example.com/abc-def")).toEqual({
            ok: true,
            url: "https://meet.example.com/abc-def",
        });
    });

    it("recorta espacios", () => {
        const r = validarEnlaceReunion("  https://meet.example.com/x  ");
        expect(r).toEqual({ ok: true, url: "https://meet.example.com/x" });
    });

    it("rechaza http:// (no https)", () => {
        expect(validarEnlaceReunion("http://meet.example.com/x").ok).toBe(false);
    });

    it("rechaza otros protocolos (javascript:, data:)", () => {
        expect(validarEnlaceReunion("javascript:alert(1)").ok).toBe(false);
        expect(validarEnlaceReunion("data:text/html,<b>x</b>").ok).toBe(false);
    });

    it("rechaza marcado HTML (< o >)", () => {
        expect(validarEnlaceReunion("https://x.com/<script>").ok).toBe(false);
    });

    it("rechaza vacío y basura no-URL", () => {
        expect(validarEnlaceReunion("   ").ok).toBe(false);
        expect(validarEnlaceReunion("no soy una url").ok).toBe(false);
    });
});
