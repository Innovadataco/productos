/**
 * SPEC-215 (002-PI-115): tests unitarios del generador de códigos de referido
 * (FR-002, FR-003 — parte pura, sin base de datos).
 */
import { describe, it, expect } from "vitest";
import {
    esFormatoCodigoReferidoValido,
    generarCodigoReferido,
    generarHashReferido,
} from "./referido-codigo";

describe("generarCodigoReferido", () => {
    it("genera el formato PI-<TIPO>-<HASH8> para COLEGIO", () => {
        const codigo = generarCodigoReferido("COLEGIO");
        expect(codigo).toMatch(/^PI-COLEGIO-[A-Z2-9]{8}$/);
    });

    it("genera el formato PI-<TIPO>-<HASH8> para PADRE", () => {
        const codigo = generarCodigoReferido("PADRE");
        expect(codigo).toMatch(/^PI-PADRE-[A-Z2-9]{8}$/);
    });

    it("nunca incluye los caracteres ambiguos O, 0, I, 1 en el hash", () => {
        for (let i = 0; i < 200; i++) {
            const hash = generarHashReferido();
            expect(hash).toHaveLength(8);
            expect(hash).not.toMatch(/[O0I1]/);
        }
    });

    it("genera códigos distintos en rachas (probabilidad de colisión despreciable)", () => {
        const generados = new Set<string>();
        for (let i = 0; i < 500; i++) {
            generados.add(generarCodigoReferido("PADRE"));
        }
        expect(generados.size).toBe(500);
    });

    it("cada código generado pasa su propia validación de formato", () => {
        for (let i = 0; i < 50; i++) {
            expect(esFormatoCodigoReferidoValido(generarCodigoReferido("COLEGIO"))).toBe(true);
            expect(esFormatoCodigoReferidoValido(generarCodigoReferido("PADRE"))).toBe(true);
        }
    });
});

describe("esFormatoCodigoReferidoValido", () => {
    it("acepta un código bien formado y normaliza espacios/minúsculas", () => {
        expect(esFormatoCodigoReferidoValido("PI-COLEGIO-A7F3D2E9")).toBe(true);
        expect(esFormatoCodigoReferidoValido("  pi-padre-a7f3d2e9 ")).toBe(true);
    });

    it("rechaza códigos con caracteres ambiguos en el hash", () => {
        expect(esFormatoCodigoReferidoValido("PI-COLEGIO-A0F3D2E9")).toBe(false);
        expect(esFormatoCodigoReferidoValido("PI-PADRE-IOO11111")).toBe(false);
    });

    it("rechaza formatos ajenos", () => {
        expect(esFormatoCodigoReferidoValido("REF-BONO-123")).toBe(false);
        expect(esFormatoCodigoReferidoValido("PI-EMPRESA-A7F3D2E9")).toBe(false);
        expect(esFormatoCodigoReferidoValido("PI-PADRE-A7F3D2E")).toBe(false);
        expect(esFormatoCodigoReferidoValido("")).toBe(false);
    });
});
