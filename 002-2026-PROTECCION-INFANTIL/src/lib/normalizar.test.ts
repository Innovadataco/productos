import { describe, it, expect } from "vitest";
import { normalizarNombreGeografico } from "./normalizar";

describe("normalizarNombreGeografico (SPEC-115)", () => {
    it("elimina diacríticos y pasa a minúsculas", () => {
        expect(normalizarNombreGeografico("Medellín")).toBe("medellin");
        expect(normalizarNombreGeografico("Mérida")).toBe("merida");
        expect(normalizarNombreGeografico("São Paulo")).toBe("sao paulo");
        expect(normalizarNombreGeografico("Asunción")).toBe("asuncion");
    });

    it("la ñ se normaliza a n (NFD descompone el tilde)", () => {
        expect(normalizarNombreGeografico("Ibagué Ñandú")).toBe("ibague nandu");
    });

    it("colapsa caracteres no alfanuméricos a un espacio", () => {
        expect(normalizarNombreGeografico("Bogotá  D.C.")).toBe("bogota d c");
        expect(normalizarNombreGeografico("San José del Guaviare")).toBe("san jose del guaviare");
    });

    it("es idempotente y tolera entradas ya normalizadas", () => {
        const n = normalizarNombreGeografico("Río de Janeiro");
        expect(normalizarNombreGeografico(n)).toBe(n);
    });
});
