/**
 * SPEC-796 · Tests del almacenamiento del contrato del colegio (unit, sin BD).
 * Cubre: cifrado en reposo + round-trip, id OPACO, validación PDF-only, y que la
 * eliminación (solo purga demo) sea idempotente.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
    guardarContrato,
    leerContrato,
    eliminarContrato,
    rutaContrato,
    validarContratoSubido,
} from "./contrato-colegio-storage";

const PDF = Buffer.concat([Buffer.from("%PDF-"), Buffer.from("contenido-del-contrato-firmado")]);
const NO_PDF = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from("png")]); // PNG magic

let dir: string;

beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "contratos-test-"));
    process.env.CONTRATOS_COLEGIOS_STORAGE_DIR = dir;
});

afterAll(async () => {
    delete process.env.CONTRATOS_COLEGIOS_STORAGE_DIR;
    await rm(dir, { recursive: true, force: true });
});

describe("SPEC-796 · contrato-colegio-storage", () => {
    it("guarda cifrado y lee de vuelta el PDF idéntico (round-trip)", async () => {
        const { archivoId, sha256 } = await guardarContrato(PDF);
        expect(archivoId).toMatch(/^[0-9a-f-]{36}$/); // uuid opaco
        expect(sha256).toMatch(/^[0-9a-f]{64}$/);
        const leido = await leerContrato(archivoId);
        expect(leido.equals(PDF)).toBe(true);
    });

    it("el archivo en disco está CIFRADO (no es el PDF en claro)", async () => {
        const { archivoId } = await guardarContrato(PDF);
        const enDisco = await readFile(rutaContrato(archivoId));
        expect(enDisco.subarray(0, 5).equals(Buffer.from("%PDF-"))).toBe(false);
        expect(enDisco.equals(PDF)).toBe(false);
    });

    it("dos guardados dan ids OPACOS distintos (nombre no adivinable)", async () => {
        const a = await guardarContrato(PDF);
        const b = await guardarContrato(PDF);
        expect(a.archivoId).not.toBe(b.archivoId);
        const archivos = await readdir(dir);
        expect(archivos).toContain(`${a.archivoId}.enc`);
        expect(archivos).toContain(`${b.archivoId}.enc`);
    });

    it("validación: PDF válido ok; vacío, sobre-tope y no-PDF fallan", () => {
        const opts = { maxBytes: 1024, maxMb: 1, sujeto: "El contrato" };
        expect(validarContratoSubido(PDF, opts).ok).toBe(true);
        expect(validarContratoSubido(Buffer.alloc(0), opts).ok).toBe(false);
        expect(validarContratoSubido(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(2048)]), opts).ok).toBe(false);
        expect(validarContratoSubido(NO_PDF, opts).ok).toBe(false);
    });

    it("eliminar (solo purga demo) borra el archivo y es idempotente", async () => {
        const { archivoId } = await guardarContrato(PDF);
        await eliminarContrato(archivoId);
        await expect(leerContrato(archivoId)).rejects.toThrow();
        // segunda vez: no lanza (idempotente)
        await expect(eliminarContrato(archivoId)).resolves.toBeUndefined();
    });
});
