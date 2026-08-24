/**
 * SPEC-211 (002-PI-111): tests unitarios de la validación pura de comprobantes
 * (tamaño + formato). El guardado cifrado se cubre en tests de integración.
 */
import { describe, it, expect } from "vitest";
import { validarComprobante, rutaComprobante, getComprobantesStorageDir } from "./comprobante-storage";

const LIMITES = { tamanoMaxMB: 1, formatosPermitidos: ["image/png", "image/jpeg", "application/pdf"] };

function bufferDe(bytes: number): Buffer {
    return Buffer.alloc(bytes, 7);
}

describe("validarComprobante", () => {
    it("acepta un PNG dentro del límite", () => {
        expect(validarComprobante(bufferDe(1024), "image/png", LIMITES)).toEqual({ ok: true });
    });

    it("rechaza un archivo vacío", () => {
        const r = validarComprobante(Buffer.alloc(0), "image/png", LIMITES);
        expect(r.ok).toBe(false);
        expect(r.motivo).toContain("vacío");
    });

    it("rechaza cuando excede el tamaño máximo", () => {
        const r = validarComprobante(bufferDe(1024 * 1024 + 1), "image/png", LIMITES);
        expect(r.ok).toBe(false);
        expect(r.motivo).toContain("tamaño máximo");
    });

    it("acepta exactamente el tamaño máximo", () => {
        expect(validarComprobante(bufferDe(1024 * 1024), "image/png", LIMITES).ok).toBe(true);
    });

    it("rechaza un MIME no permitido", () => {
        const r = validarComprobante(bufferDe(100), "image/gif", LIMITES);
        expect(r.ok).toBe(false);
        expect(r.motivo).toContain("Formato");
    });

    it("normaliza mayúsculas y espacios del MIME", () => {
        expect(validarComprobante(bufferDe(100), " IMAGE/PNG ", LIMITES).ok).toBe(true);
    });
});

describe("rutas de almacenamiento", () => {
    it("la ruta del comprobante cuelga del directorio configurado y es opaca", () => {
        const ruta = rutaComprobante("abc-123");
        expect(ruta.startsWith(getComprobantesStorageDir())).toBe(true);
        expect(ruta.endsWith("abc-123.enc")).toBe(true);
        expect(ruta).not.toContain("public");
    });
});
