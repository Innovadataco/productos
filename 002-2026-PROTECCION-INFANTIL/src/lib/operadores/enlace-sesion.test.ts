/**
 * SPEC-750 · unit de la regla PURA del enlace: validación (https/no-HTML). Sin BD.
 * (SPEC-778 eliminó `enlaceVisibleParaCita` y su test: la visibilidad se deriva de
 * `estadoEfectivoDeCita` (746) en `enlace-derivado.ts`, con su propio candado.)
 */
import { describe, it, expect } from "vitest";
import { validarEnlaceReunion, type ProveedorEnlace } from "./enlace-validacion";

// SPEC-793: `validarEnlaceReunion` ahora exige que el host sea de un proveedor APROBADO. Estos casos
// prueban la regla de FORMATO (https/no-HTML/recorte) independiente del contenido de la allowlist real,
// inyectando un proveedor de PRUEBA que aprueba `meet.example.com`. (Antes de 793 se aceptaba cualquier
// https — ese era exactamente el agujero que 793 cierra; la cobertura de la allowlist vive en
// `enlace-proveedor-aprobado.candado.test.ts`.)
const PROVEEDOR_TEST: readonly ProveedorEnlace[] = [
    { nombre: "Test", dominios: ["meet.example.com"], porque: "fixture de formato", aprobado: true },
];

describe("validarEnlaceReunion · solo https, jamás HTML", () => {
    it("acepta un https válido de un proveedor aprobado", () => {
        expect(validarEnlaceReunion("https://meet.example.com/abc-def", PROVEEDOR_TEST)).toEqual({
            ok: true,
            url: "https://meet.example.com/abc-def",
        });
    });

    it("recorta espacios", () => {
        const r = validarEnlaceReunion("  https://meet.example.com/x  ", PROVEEDOR_TEST);
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
