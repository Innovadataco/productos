/**
 * SPEC-211 (002-PI-111): almacenamiento cifrado de comprobantes de pago.
 *
 * Mismo patrón que `apelacion-storage.ts` (SPEC-110): disco local FUERA de la
 * raíz web, nombre opaco, AES-256-GCM con la clave de parámetros. Se reutilizan
 * `cifrarBuffer`/`sha256Hex` de ese módulo para no duplicar criptografía.
 *
 * - Ubicación: `storage/comprobantes/`, override de entorno `COMPROBANTES_STORAGE_DIR`.
 * - Nombre: `<archivoId>.enc` (uuid; sin relación con el nombre original).
 * - Lo que se persiste en `Pago.comprobanteAdjuntoUrl` es la ruta del archivo
 *   cifrado (no una URL pública; el comprobante nunca se expone sin auth).
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { cifrarBuffer, sha256Hex } from "@/lib/apelacion-storage";

export interface LimitesComprobante {
    tamanoMaxMB: number;
    formatosPermitidos: string[];
}

export function getComprobantesStorageDir(): string {
    return process.env.COMPROBANTES_STORAGE_DIR ?? path.join(process.cwd(), "storage", "comprobantes");
}

export function rutaComprobante(archivoId: string): string {
    return path.join(getComprobantesStorageDir(), `${archivoId}.enc`);
}

/**
 * Valida tamaño y tipo MIME del comprobante según los parámetros del módulo de
 * pagos (`pagos.comprobante_tamaño_max_mb`, `pagos.comprobante_formatos_permitidos`).
 * Función pura: no toca disco ni red.
 */
export function validarComprobante(
    buffer: Buffer,
    mimeType: string,
    limites: LimitesComprobante
): { ok: boolean; motivo?: string } {
    if (buffer.length === 0) {
        return { ok: false, motivo: "El comprobante está vacío" };
    }
    const tamanoMaxBytes = limites.tamanoMaxMB * 1024 * 1024;
    if (buffer.length > tamanoMaxBytes) {
        return { ok: false, motivo: `El archivo excede el tamaño máximo permitido (${limites.tamanoMaxMB} MB)` };
    }
    const mime = mimeType.trim().toLowerCase();
    const permitidos = limites.formatosPermitidos.map((f) => f.trim().toLowerCase());
    if (!permitidos.includes(mime)) {
        return { ok: false, motivo: "Formato de comprobante no permitido" };
    }
    return { ok: true };
}

export interface ComprobanteGuardado {
    ruta: string;
    hashSha256: string;
}

/**
 * Cifra el comprobante y lo escribe en disco. Devuelve ruta + hash SHA256 del
 * contenido original (el hash se calcula ANTES de cifrar, sobre los bytes que
 * subió el cliente). Lanza si no hay clave de cifrado configurada (fail-closed,
 * igual que apelaciones).
 */
export async function guardarComprobanteCifrado(plaintext: Buffer): Promise<ComprobanteGuardado> {
    const hashSha256 = sha256Hex(plaintext);
    const encrypted = cifrarBuffer(plaintext);
    const archivoId = randomUUID();
    const dir = getComprobantesStorageDir();
    await mkdir(dir, { recursive: true });
    const ruta = rutaComprobante(archivoId);
    await writeFile(ruta, encrypted);
    return { ruta, hashSha256 };
}
