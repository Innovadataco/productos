/**
 * SPEC-341 · T011 · guardas del hash determinista de la cadena.
 */
import { describe, it, expect } from "vitest";
import { calcularHashCadena } from "./hash-cadena";

const BASE = {
    ultimoEventoEn: new Date("2026-09-01T10:00:00Z"),
    numEventos: 5,
    categoriasDominantesJson: { CONTACTO_INSISTENTE: 3, SOLICITUD_MATERIAL: 2 },
};

describe("calcularHashCadena", () => {
    it("mismo input → mismo hash (determinista)", () => {
        expect(calcularHashCadena(BASE)).toBe(calcularHashCadena({ ...BASE }));
    });

    it("cambia si cambia ultimoEventoEn", () => {
        const otro = { ...BASE, ultimoEventoEn: new Date("2026-09-01T11:00:00Z") };
        expect(calcularHashCadena(otro)).not.toBe(calcularHashCadena(BASE));
    });

    it("cambia si cambia numEventos", () => {
        expect(calcularHashCadena({ ...BASE, numEventos: 6 })).not.toBe(calcularHashCadena(BASE));
    });

    it("cambia si cambia categoriasDominantesJson", () => {
        const otro = { ...BASE, categoriasDominantesJson: { CONTACTO_INSISTENTE: 4, SOLICITUD_MATERIAL: 2 } };
        expect(calcularHashCadena(otro)).not.toBe(calcularHashCadena(BASE));
    });

    it("insensible al orden de claves del JSON (normalización)", () => {
        const original = { ...BASE, categoriasDominantesJson: { A: 1, B: 2, C: 3 } };
        const reordenado = { ...BASE, categoriasDominantesJson: { C: 3, A: 1, B: 2 } };
        expect(calcularHashCadena(original)).toBe(calcularHashCadena(reordenado));
    });

    it("acepta ultimoEventoEn=null (expediente sin hechos)", () => {
        const sinHechos = { ...BASE, ultimoEventoEn: null, numEventos: 0 };
        expect(calcularHashCadena(sinHechos)).toEqual(expect.any(String));
        expect(calcularHashCadena(sinHechos)).toHaveLength(64); // SHA-256 hex
    });

    it("acepta categoriasDominantesJson=null", () => {
        expect(() => calcularHashCadena({ ...BASE, categoriasDominantesJson: null })).not.toThrow();
    });
});
