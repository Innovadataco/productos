/**
 * SPEC-227 (002-PI-128): tests unitarios de la pseudonimización del sujeto
 * (FR-007): hash SHA-256 con sal truncado a 16 hex, estable entre exports,
 * irreversible, fail-closed sin sal.
 */
import { describe, it, expect } from "vitest";
import { pseudonimizarSujeto } from "./pseudonimizar";

const SAL = "sal-de-prueba-32-chars-minimo-0000";

describe("pseudonimizarSujeto", () => {
    it("devuelve 16 caracteres hex", () => {
        const hash = pseudonimizarSujeto("suj-123", SAL);
        expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("es estable entre exports (mismo sujeto y sal → mismo hash)", () => {
        expect(pseudonimizarSujeto("suj-123", SAL)).toBe(pseudonimizarSujeto("suj-123", SAL));
    });

    it("distingue sujetos distintos", () => {
        expect(pseudonimizarSujeto("suj-123", SAL)).not.toBe(pseudonimizarSujeto("suj-456", SAL));
    });

    it("la sal cambia el hash (irreversible sin conocerla)", () => {
        expect(pseudonimizarSujeto("suj-123", SAL)).not.toBe(pseudonimizarSujeto("suj-123", "otra-sal"));
    });

    it("nunca contiene el id crudo", () => {
        expect(pseudonimizarSujeto("suj-123", SAL)).not.toContain("suj-123");
    });

    it("fail-closed: lanza si la sal no está definida", () => {
        expect(() => pseudonimizarSujeto("suj-123", undefined)).toThrow();
        expect(() => pseudonimizarSujeto("suj-123", "")).toThrow();
    });

    it("sujeto null → null (fila sin sujeto, no exige sal)", () => {
        expect(pseudonimizarSujeto(null, SAL)).toBeNull();
        expect(pseudonimizarSujeto(null, undefined)).toBeNull();
    });
});
