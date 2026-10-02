/**
 * SPEC-750 + SPEC-854 · unit de la regla PURA del enlace: validación https/no-HTML. Sin BD.
 * (SPEC-778 eliminó `enlaceVisibleParaCita`; SPEC-854 quitó la allowlist de proveedores (SPEC-793):
 * ahora CUALQUIER https válido pasa — ya no se inyecta un proveedor de prueba.)
 */
import { describe, it, expect } from "vitest";
import { validarEnlaceReunion } from "./enlace-validacion";

describe("validarEnlaceReunion · solo https, jamás HTML (sin allowlist de proveedor)", () => {
    it("acepta CUALQUIER https válido — Meet, Zoom, Teams, Jitsi, el que sea (SPEC-854)", () => {
        for (const url of [
            "https://meet.google.com/abc-def",
            "https://zoom.us/j/123456789",
            "https://teams.microsoft.com/l/meetup-join/xyz",
            "https://meet.jit.si/SalaDePrueba",
            "https://cualquier-proveedor.example/sala-abc",
        ]) {
            expect(validarEnlaceReunion(url)).toEqual({ ok: true, url });
        }
    });

    it("recorta espacios", () => {
        expect(validarEnlaceReunion("  https://meet.example.com/x  ")).toEqual({
            ok: true,
            url: "https://meet.example.com/x",
        });
    });

    it("rechaza http:// (no https)", () => {
        expect(validarEnlaceReunion("http://meet.example.com/x").ok).toBe(false);
    });

    it("rechaza otros protocolos (javascript:, data:)", () => {
        expect(validarEnlaceReunion("javascript:alert(1)").ok).toBe(false);
        expect(validarEnlaceReunion("data:text/html,x").ok).toBe(false);
    });

    it("rechaza marcado HTML (< o >)", () => {
        expect(validarEnlaceReunion("https://x.com/<script>").ok).toBe(false);
    });

    it("rechaza vacío y basura no-URL", () => {
        expect(validarEnlaceReunion("   ").ok).toBe(false);
        expect(validarEnlaceReunion("no soy una url").ok).toBe(false);
    });
});
