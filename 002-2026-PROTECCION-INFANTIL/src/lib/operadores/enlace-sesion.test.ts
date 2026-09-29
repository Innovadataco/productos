/**
 * SPEC-750 · unit de las reglas PURAS del enlace: validación (https/no-HTML) y
 * visibilidad derivada del tiempo. Sin BD.
 */
import { describe, it, expect } from "vitest";
import { validarEnlaceReunion, enlaceVisibleParaCita } from "./enlace-validacion";

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

describe("enlaceVisibleParaCita · publicado y antes del fin de la cita", () => {
    const fin = new Date("2026-09-20T15:00:00Z");

    it("publicado + antes del fin → visible", () => {
        expect(enlaceVisibleParaCita(true, fin, new Date("2026-09-20T14:30:00Z"))).toBe(true);
    });
    it("publicado + pasada la hora → oculto", () => {
        expect(enlaceVisibleParaCita(true, fin, new Date("2026-09-20T15:30:00Z"))).toBe(false);
    });
    it("no publicado → oculto aunque sea antes", () => {
        expect(enlaceVisibleParaCita(false, fin, new Date("2026-09-20T14:30:00Z"))).toBe(false);
    });
});
