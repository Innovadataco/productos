import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { getEncryptionKey } from "./param-encryption";

/**
 * SPEC-110 — Almacenamiento cifrado de la evidencia documental de apelaciones.
 *
 * - Ubicación: `storage/apelaciones/` FUERA de la raíz web (nunca bajo `public/`),
 *   con override de entorno `APELACIONES_STORAGE_DIR`.
 * - Nombre opaco: `<documentoId>.enc` (cuid; sin relación con el nombre original).
 * - Cifrado: AES-256-GCM con la misma clave de parámetros (`PARAM_ENCRYPTION_KEY`,
 *   vía `getEncryptionKey()` de `param-encryption.ts`). Formato binario del archivo:
 *   `[IV 16B][TAG 16B][ciphertext]`.
 * - Fail-closed: sin clave configurada no se persiste evidencia (error antes de escribir).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const PDF_MAGIC = Buffer.from("%PDF-", "ascii");

export class ApelacionStorageError extends Error {
    constructor(
        message: string,
        public readonly code: "CLAVE_NO_CONFIGURADA" | "ARCHIVO_NO_ENCONTRADO" | "INTEGRIDAD_INVALIDA"
    ) {
        super(message);
        Object.setPrototypeOf(this, ApelacionStorageError.prototype);
    }
}

function requireKey(): Buffer {
    const key = getEncryptionKey();
    if (!key) {
        throw new ApelacionStorageError(
            "PARAM_ENCRYPTION_KEY no configurada o inválida (se requieren 32 bytes)",
            "CLAVE_NO_CONFIGURADA"
        );
    }
    return key;
}

export function getApelacionesStorageDir(): string {
    return process.env.APELACIONES_STORAGE_DIR ?? path.join(process.cwd(), "storage", "apelaciones");
}

export function rutaDocumentoApelacion(documentoId: string): string {
    return path.join(getApelacionesStorageDir(), `${documentoId}.enc`);
}

export function cifrarBuffer(plaintext: Buffer): Buffer {
    const key = requireKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]);
}

export function descifrarBuffer(encrypted: Buffer): Buffer {
    const key = requireKey();
    if (encrypted.length < IV_LENGTH + TAG_LENGTH + 1) {
        throw new ApelacionStorageError("Formato de archivo cifrado inválido", "INTEGRIDAD_INVALIDA");
    }
    const iv = encrypted.subarray(0, IV_LENGTH);
    const tag = encrypted.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = encrypted.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function sha256Hex(data: Buffer): string {
    return createHash("sha256").update(data).digest("hex");
}

/**
 * Valida que el archivo sea un PDF real: MIME declarado y magic bytes `%PDF-`.
 * El tamaño se valida en la ruta (depende del parámetro apelacion.max_tamano_documento_mb).
 */
export function validarPdf(buffer: Buffer, mimeDeclarado: string | null | undefined): { ok: boolean; motivo?: string } {
    if (mimeDeclarado !== "application/pdf") {
        return { ok: false, motivo: "El documento debe ser un PDF" };
    }
    if (buffer.length < PDF_MAGIC.length || !buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
        return { ok: false, motivo: "El archivo no es un PDF válido" };
    }
    return { ok: true };
}

/**
 * Cifra el PDF y lo escribe en disco. Devuelve la ruta del archivo `.enc`.
 * Lanza ApelacionStorageError(CLAVE_NO_CONFIGURADA) si no hay clave (fail-closed).
 */
export async function guardarDocumentoCifrado(documentoId: string, plaintext: Buffer): Promise<string> {
    const encrypted = cifrarBuffer(plaintext);
    const dir = getApelacionesStorageDir();
    await mkdir(dir, { recursive: true });
    const ruta = rutaDocumentoApelacion(documentoId);
    await writeFile(ruta, encrypted);
    return ruta;
}

export async function leerDocumentoDescifrado(rutaArchivo: string): Promise<Buffer> {
    let encrypted: Buffer;
    try {
        encrypted = await readFile(rutaArchivo);
    } catch {
        throw new ApelacionStorageError("El documento ya no está disponible", "ARCHIVO_NO_ENCONTRADO");
    }
    return descifrarBuffer(encrypted);
}

export async function eliminarDocumentoCifrado(rutaArchivo: string): Promise<void> {
    try {
        await unlink(rutaArchivo);
    } catch {
        // Ya no existe: la purga es idempotente.
    }
}
