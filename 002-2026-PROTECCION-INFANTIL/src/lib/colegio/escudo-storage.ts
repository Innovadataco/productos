/**
 * SPEC-351 (A-69 · D1 · T010) — el escudo institucional del colegio.
 *
 * Mismo patrón de disco que comprobante-storage (SPEC-110/244): carpeta local
 * FUERA de public/, override por env para tests/compose. El escudo NO es PII
 * (es el logo público del colegio) — se guarda plano, sin cifrar.
 *
 * Candado CEO 01-09: SOLO PNG/JPG. El SVG queda prohibido explícitamente
 * (puede cargar scripts y se incrusta en el PDF y en Configuración).
 */
import path from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";

export const ESCUDO_TAMANO_MAX_BYTES = 500 * 1024; // 500 KB (spec FR-008)

const MAGIA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const MAGIA_JPG = Buffer.from([0xff, 0xd8, 0xff]);

export function getEscudosStorageDir(): string {
    return process.env.ESCUDOS_STORAGE_DIR ?? path.join(process.cwd(), "storage", "escudos");
}

export function rutaEscudo(assetKey: string): string {
    // assetKey es "<colegioId>.<ext>" — path.basename evita traversal.
    return path.join(getEscudosStorageDir(), path.basename(assetKey));
}

export type ValidacionEscudo = { ok: true; ext: "png" | "jpg" } | { ok: false; motivo: string };

/**
 * Valida por MAGIA DE BYTES (no por extensión declarada — un SVG renombrado
 * a .png no pasa). Función pura.
 */
export function validarEscudo(buffer: Buffer): ValidacionEscudo {
    if (buffer.length === 0) return { ok: false, motivo: "El archivo está vacío" };
    if (buffer.length > ESCUDO_TAMANO_MAX_BYTES) {
        return { ok: false, motivo: "El escudo supera el tamaño máximo de 500 KB" };
    }
    if (buffer.subarray(0, 4).equals(MAGIA_PNG)) return { ok: true, ext: "png" };
    if (buffer.subarray(0, 3).equals(MAGIA_JPG)) return { ok: true, ext: "jpg" };
    return { ok: false, motivo: "Formato no permitido: solo PNG o JPG (el SVG está prohibido)" };
}

/** Guarda el escudo y devuelve la clave del asset (para Colegio.escudoAssetKey). */
export async function guardarEscudo(colegioId: string, buffer: Buffer): Promise<{ assetKey: string }> {
    const v = validarEscudo(buffer);
    if (!v.ok) throw new Error(v.motivo);
    const assetKey = `${colegioId}.${v.ext}`;
    await mkdir(getEscudosStorageDir(), { recursive: true });
    await writeFile(rutaEscudo(assetKey), buffer);
    return { assetKey };
}

/** Lee el escudo como data URI para incrustar en el PDF (pdfmake `image`). null si no existe. */
export async function leerEscudoDataUri(assetKey: string | null): Promise<string | null> {
    if (!assetKey) return null;
    try {
        const buffer = await readFile(rutaEscudo(assetKey));
        const mime = assetKey.endsWith(".png") ? "image/png" : "image/jpeg";
        return `data:${mime};base64,${buffer.toString("base64")}`;
    } catch {
        return null; // escudo borrado del disco: el PDF sale con membrete neutro
    }
}
