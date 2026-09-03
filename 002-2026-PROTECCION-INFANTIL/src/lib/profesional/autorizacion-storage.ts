/**
 * SPEC-391 · almacenamiento PROTEGIDO de la autorización firmada del profesional.
 *
 * Ley 2375/2024: la autorización que permite consultar antecedentes es
 * información RESERVADA — se archiva, se sirve tras autenticación y no puede
 * quedar tras una URL adivinable. Este módulo sigue el patrón de
 * `apelacion-storage.ts` (SPEC-110) y reusa `cifrarBuffer`/`sha256Hex` para no
 * volver a implementar criptografía:
 *
 * · Ubicación: `storage/autorizaciones-profesionales/` FUERA de la raíz web,
 *   override de entorno `AUTORIZACIONES_PROFESIONALES_STORAGE_DIR`.
 * · Nombre opaco: `<archivoId>.enc` (uuid; sin relación con el nombre
 *   original que subió el profesional).
 * · Cifrado: AES-256-GCM con `PARAM_ENCRYPTION_KEY`.
 * · Fail-closed: sin clave configurada NO se persiste evidencia (el `cifrarBuffer`
 *   de apelacion-storage lanza `ApelacionStorageError`).
 * · Validación por MAGIA DE BYTES (no por extensión). Aceptados: PDF, PNG, JPG
 *   — el CEO 03-09 04:32 pidió los tres porque la gente le toma foto al documento
 *   con el teléfono, no lo escanea.
 * · Lo que se persiste en `PerfilProfesional.autorizacionArchivoUrl` es esta
 *   ruta local del archivo cifrado, NUNCA una URL pública.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cifrarBuffer, descifrarBuffer, sha256Hex } from "@/lib/apelacion-storage";

export const AUTORIZACION_TAMANO_MAX_BYTES = 5 * 1024 * 1024;
const MAGIA_PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
const MAGIA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const MAGIA_JPG = Buffer.from([0xff, 0xd8, 0xff]);

export type ExtensionAutorizacion = "pdf" | "png" | "jpg";

export type ResultadoValidacion =
    | { ok: true; extension: ExtensionAutorizacion }
    | { ok: false; motivo: string };

export function getAutorizacionesStorageDir(): string {
    return (
        process.env.AUTORIZACIONES_PROFESIONALES_STORAGE_DIR ??
        path.join(process.cwd(), "storage", "autorizaciones-profesionales")
    );
}

export function rutaAutorizacion(archivoId: string): string {
    // `path.basename` como salvaguarda contra path traversal — jamás confiar
    // en que el id venga limpio (aunque lo generemos con `randomUUID`, el helper
    // se puede llamar con un valor traído de BD).
    return path.join(getAutorizacionesStorageDir(), `${path.basename(archivoId)}.enc`);
}

/** Función pura: valida contenido, tamaño y firma. NO toca disco ni red. */
export function validarAutorizacion(buffer: Buffer): ResultadoValidacion {
    if (buffer.length === 0) return { ok: false, motivo: "El archivo está vacío" };
    if (buffer.length > AUTORIZACION_TAMANO_MAX_BYTES) {
        return { ok: false, motivo: "La autorización supera el tamaño máximo de 5 MB" };
    }
    if (buffer.subarray(0, 5).equals(MAGIA_PDF)) return { ok: true, extension: "pdf" };
    if (buffer.subarray(0, 4).equals(MAGIA_PNG)) return { ok: true, extension: "png" };
    if (buffer.subarray(0, 3).equals(MAGIA_JPG)) return { ok: true, extension: "jpg" };
    return { ok: false, motivo: "Formato no aceptado. Sube un PDF, PNG o JPG." };
}

export interface AutorizacionGuardada {
    archivoId: string;
    rutaCifrada: string;
    sha256: string;
    extension: ExtensionAutorizacion;
}

/**
 * Cifra y guarda el archivo. Devuelve el `archivoId` (uuid) y el hash del
 * texto en claro — el hash se persiste junto con la ruta para poder verificar
 * integridad al leer sin descifrar todo el disco.
 */
export async function guardarAutorizacion(
    buffer: Buffer,
    extension: ExtensionAutorizacion
): Promise<AutorizacionGuardada> {
    const dir = getAutorizacionesStorageDir();
    await mkdir(dir, { recursive: true });
    const archivoId = randomUUID();
    const rutaCifrada = rutaAutorizacion(archivoId);
    const cifrado = cifrarBuffer(buffer);
    await writeFile(rutaCifrada, cifrado);
    return {
        archivoId,
        rutaCifrada,
        sha256: sha256Hex(buffer),
        extension,
    };
}

/** Lee y descifra. Solo el módulo de admin (L2) debería llamar esto. */
export async function leerAutorizacion(archivoId: string): Promise<Buffer> {
    const cifrado = await readFile(rutaAutorizacion(archivoId));
    return descifrarBuffer(cifrado);
}
