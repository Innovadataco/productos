/**
 * SPEC-391 · candados del storage protegido de la autorización.
 * Función pura: validar por MAGIA DE BYTES (no por extensión declarada — una
 * hoja de texto renombrada .pdf NO pasa) + tope 5 MB.
 */
import { describe, it, expect } from "vitest";
import {
    validarAutorizacion,
    AUTORIZACION_TAMANO_MAX_BYTES,
} from "./autorizacion-storage";

const PDF = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]), Buffer.from("resto...")]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from("resto...")]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("resto...")]);

describe("validarAutorizacion (SPEC-391)", () => {
    it("acepta PDF por magia de bytes", () => {
        const r = validarAutorizacion(PDF);
        expect(r).toEqual({ ok: true, extension: "pdf" });
    });

    it("acepta PNG (foto del documento tomada con el teléfono)", () => {
        const r = validarAutorizacion(PNG);
        expect(r).toEqual({ ok: true, extension: "png" });
    });

    it("acepta JPG", () => {
        const r = validarAutorizacion(JPG);
        expect(r).toEqual({ ok: true, extension: "jpg" });
    });

    it("rechaza texto plano renombrado .pdf — la magia es la que manda", () => {
        const textoRenombrado = Buffer.from("Esto no es un PDF, aunque el archivo se llame .pdf");
        const r = validarAutorizacion(textoRenombrado);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.motivo).toContain("Formato no aceptado");
    });

    it("rechaza archivo vacío", () => {
        const r = validarAutorizacion(Buffer.alloc(0));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.motivo).toContain("vacío");
    });

    it("rechaza archivo mayor a 5 MB", () => {
        const grande = Buffer.alloc(AUTORIZACION_TAMANO_MAX_BYTES + 1, 0x25); // magia PDF pero enorme
        const r = validarAutorizacion(grande);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.motivo).toContain("5 MB");
    });
});
