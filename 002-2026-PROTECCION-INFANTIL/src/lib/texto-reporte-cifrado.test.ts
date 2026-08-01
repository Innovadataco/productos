/**
 * SPEC-130 (BL-4, O-3): helper de cifrado del texto del reporte.
 * Idempotencia en lectura y escritura; el marcador de purga nunca se cifra.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
    MARCADOR_TEXTO_PURGADO,
    estaCifradoTextoReporte,
    descifrarTextoReporte,
    cifrarTextoReporte,
    purgaTextoReporte,
} from "./texto-reporte-cifrado";
import { isEncryptedValue } from "./param-encryption";

// Clave SOLO de tests (no productiva); getEncryptionKey la lee de la variable.
beforeAll(() => {
    process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
});

describe("texto-reporte-cifrado (SPEC-130)", () => {
    it("cifra y descifra conservando el contenido íntegro (la evidencia no se altera)", () => {
        const original = "El usuario me pidió fotos por WhatsApp tres veces.";
        const cifrado = cifrarTextoReporte(original);
        expect(cifrado).not.toBe(original);
        expect(isEncryptedValue(cifrado)).toBe(true);
        expect(descifrarTextoReporte(cifrado)).toBe(original);
    });

    it("NO re-cifra un valor ya cifrado (idempotencia en escritura, O-3)", () => {
        const cifrado = cifrarTextoReporte("texto de prueba");
        expect(cifrarTextoReporte(cifrado)).toBe(cifrado);
    });

    it("lectura idempotente: texto plano legado se devuelve tal cual (ventana de migración)", () => {
        expect(descifrarTextoReporte("texto en claro histórico")).toBe("texto en claro histórico");
        expect(estaCifradoTextoReporte("texto en claro histórico")).toBe(false);
        expect(estaCifradoTextoReporte(cifrarTextoReporte("x"))).toBe(true);
    });

    it("el marcador de purga no se cifra ni se descifra (D4/O-2)", () => {
        expect(purgaTextoReporte()).toBe(MARCADOR_TEXTO_PURGADO);
        expect(cifrarTextoReporte(MARCADOR_TEXTO_PURGADO)).toBe(MARCADOR_TEXTO_PURGADO);
        expect(descifrarTextoReporte(MARCADOR_TEXTO_PURGADO)).toBe(MARCADOR_TEXTO_PURGADO);
        expect(estaCifradoTextoReporte(MARCADOR_TEXTO_PURGADO)).toBe(false);
    });

    it("nulos/vacíos no rompen", () => {
        expect(descifrarTextoReporte(null)).toBe("");
        expect(descifrarTextoReporte(undefined)).toBe("");
        expect(estaCifradoTextoReporte(null)).toBe(false);
    });
});
