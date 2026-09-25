/**
 * SPEC-391 · candados del storage protegido de la autorización + SPEC-726.
 * Función pura: validar por MAGIA DE BYTES (no por extensión declarada — una
 * hoja de texto renombrada .pdf NO pasa) + tope que pasa el llamador (parámetro).
 * SPEC-726: el error de tamaño NOMBRA el sujeto (no «la autorización» fijo) y el
 * de formato va en USTED («Suba…»).
 */
import { describe, it, expect } from "vitest";
import { validarArchivoSubido, detectarFormato } from "./autorizacion-storage";

const mbABytes = (mb: number) => mb * 1024 * 1024;

const PDF = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]), Buffer.from("resto...")]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from("resto...")]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("resto...")]);

const OPTS = { maxBytes: mbABytes(5), maxMb: 5, sujeto: "La autorización" };

describe("validarArchivoSubido / detectarFormato (SPEC-391 · SPEC-726)", () => {
    it("acepta PDF, PNG (foto del documento) y JPG por magia de bytes", () => {
        expect(validarArchivoSubido(PDF, OPTS)).toEqual({ ok: true, extension: "pdf" });
        expect(validarArchivoSubido(PNG, OPTS)).toEqual({ ok: true, extension: "png" });
        expect(validarArchivoSubido(JPG, OPTS)).toEqual({ ok: true, extension: "jpg" });
    });

    it("rechaza texto renombrado — la magia manda; el error va en USTED («Suba»)", () => {
        const r = validarArchivoSubido(Buffer.from("Esto no es un PDF, aunque se llame .pdf"), OPTS);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.motivo).toContain("Formato no aceptado");
            expect(r.motivo).toContain("Suba"); // usted, no «Sube» (tuteo)
            expect(r.motivo).not.toContain("Sube ");
        }
    });

    it("rechaza archivo vacío", () => {
        const r = validarArchivoSubido(Buffer.alloc(0), OPTS);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.motivo).toContain("vacío");
    });

    it("SPEC-726: el error de tamaño NOMBRA el sujeto dado y usa el maxMb dado (no «autorización» fijo, no «5 MB» fijo)", () => {
        const grande = Buffer.alloc(mbABytes(10) + 1, 0x25); // magia PDF pero >10 MB
        const r = validarArchivoSubido(grande, {
            maxBytes: mbABytes(10),
            maxMb: 10,
            sujeto: "El documento «Tarjeta profesional vigente»",
        });
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.motivo).toContain("El documento «Tarjeta profesional vigente»");
            expect(r.motivo).toContain("10 MB");
            expect(r.motivo).not.toContain("autorización"); // el defecto de SPEC-726
        }
    });

    it("detectarFormato solo: detecta la extensión de un buffer ya guardado, sin mirar tamaño", () => {
        expect(detectarFormato(PDF)).toEqual({ ok: true, extension: "pdf" });
        const r = detectarFormato(Buffer.from("basura"));
        expect(r.ok).toBe(false);
    });
});
