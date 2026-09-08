import { describe, it, expect } from "vitest";
import {
    generarCodigoAcceso,
    normalizarCodigoAcceso,
    hashCodigoAcceso,
    hashContenidoVisto,
    LONGITUD_CODIGO,
} from "./acceso-codigo";

describe("SPEC-584 · código temporal de acceso", () => {
    it("genera códigos de 8 caracteres del alfabeto sin ambigüedades (sin 0/O/1/I)", () => {
        for (let i = 0; i < 200; i++) {
            const codigo = generarCodigoAcceso();
            expect(codigo).toHaveLength(LONGITUD_CODIGO);
            expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
            expect(codigo).not.toMatch(/[01IO]/);
        }
    });

    it("normaliza a mayúsculas y recorta espacios", () => {
        expect(normalizarCodigoAcceso("  abcd-23 45 ")).toBe("ABCD-2345");
        expect(normalizarCodigoAcceso("a b c d 2 3 4 5")).toBe("ABCD2345");
    });

    it("hashCodigoAcceso es sha-256 hex estable y distinto del valor en claro", () => {
        const hash = hashCodigoAcceso("ABCD2345");
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(hashCodigoAcceso("ABCD2345")).toBe(hash);
        expect(hashCodigoAcceso("ABCD2346")).not.toBe(hash);
    });

    it("hashContenidoVisto nunca reproduce el texto", () => {
        const texto = "relato sensible del reporte";
        const hash = hashContenidoVisto(texto);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).not.toContain(texto);
        expect(hashContenidoVisto(texto)).toBe(hash);
        expect(hashContenidoVisto("otro relato")).not.toBe(hash);
    });
});
