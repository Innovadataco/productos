/**
 * SPEC-796 · Almacenamiento PROTEGIDO del contrato firmado de un colegio.
 *
 * Un contrato firmado es un documento legal con la identidad del colegio y de su
 * representante: información RESERVADA. Sigue el patrón de `autorizacion-storage.ts`
 * (SPEC-391) y `apelacion-storage.ts` (SPEC-110) y reusa su criptografía — no se
 * reimplementa nada:
 *
 * · Ubicación: `storage/contratos-colegios/` FUERA de la raíz web (nunca bajo
 *   `public/`), override de entorno `CONTRATOS_COLEGIOS_STORAGE_DIR`.
 * · Nombre OPACO: `<archivoId>.enc` (uuid; sin relación con el nombre original ni
 *   con el colegio). Jamás una URL pública ni adivinable.
 * · Cifrado: AES-256-GCM con `PARAM_ENCRYPTION_KEY` (vía `cifrarBuffer`).
 * · Fail-closed: sin clave configurada NO se persiste (el `cifrarBuffer` lanza).
 * · Solo PDF (magia de bytes `%PDF-`, no por extensión): el alcance es subir un
 *   PDF YA firmado (la firma electrónica está fuera de alcance, radicado SPEC-796).
 *
 * Lo que se persiste en el REGISTRO del contrato (modelo de Datos, D-121) es este
 * `archivoId` opaco + su sha256, NUNCA la ruta ni una URL. El registro vive en su
 * propia tabla para SOBREVIVIR al borrado operativo del colegio (retención
 * [ABOGADO]); la purga DEMO sí lo cubre y llama a `eliminarContrato`.
 *
 * Módulo PURO respecto del schema: no toca Prisma. Es hueco-funcional declarado
 * hasta que el endpoint de subida (contra el modelo de Datos) lo cablee.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cifrarBuffer, descifrarBuffer, eliminarDocumentoCifrado, sha256Hex } from "@/lib/apelacion-storage";

const MAGIA_PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

export type ResultadoValidacionContrato =
    | { ok: true }
    | { ok: false; motivo: string };

export function getContratosStorageDir(): string {
    return (
        process.env.CONTRATOS_COLEGIOS_STORAGE_DIR ??
        path.join(process.cwd(), "storage", "contratos-colegios")
    );
}

export function rutaContrato(archivoId: string): string {
    // `path.basename` como salvaguarda contra path traversal: aunque el id lo
    // generemos con `randomUUID`, este helper se puede llamar con un valor de BD.
    return path.join(getContratosStorageDir(), `${path.basename(archivoId)}.enc`);
}

/**
 * Valida un contrato SUBIDO. Función pura (no toca disco ni red). Solo PDF.
 * El tope (`maxBytes`/`maxMb`) lo pasa el LLAMADOR (vive en ParametroSistema, no
 * se quema) para que el mensaje nombre el número vigente; el `sujeto` lo nombra en
 * usted ("El contrato"). No se reutiliza el copy de la autorización (otro sujeto).
 */
export function validarContratoSubido(
    buffer: Buffer,
    opts: { maxBytes: number; maxMb: number; sujeto: string },
): ResultadoValidacionContrato {
    if (buffer.length === 0) return { ok: false, motivo: "Ese archivo está vacío. Elija otro." };
    if (buffer.length > opts.maxBytes) {
        return {
            ok: false,
            motivo: `${opts.sujeto} pesa más del máximo permitido (${opts.maxMb} MB).`,
        };
    }
    if (buffer.length < MAGIA_PDF.length || !buffer.subarray(0, MAGIA_PDF.length).equals(MAGIA_PDF)) {
        return { ok: false, motivo: "El archivo no es un PDF. Suba el contrato firmado en PDF." };
    }
    return { ok: true };
}

export interface ContratoGuardado {
    archivoId: string;
    rutaCifrada: string;
    sha256: string;
}

/**
 * Cifra y guarda el contrato. Devuelve el `archivoId` (uuid opaco) y el sha256 del
 * texto en claro — ambos se persisten en el registro del contrato (Datos), nunca
 * la ruta. Fail-closed: sin clave, `cifrarBuffer` lanza antes de escribir.
 */
export async function guardarContrato(buffer: Buffer): Promise<ContratoGuardado> {
    const dir = getContratosStorageDir();
    await mkdir(dir, { recursive: true });
    const archivoId = randomUUID();
    const rutaCifrada = rutaContrato(archivoId);
    const cifrado = cifrarBuffer(buffer);
    await writeFile(rutaCifrada, cifrado);
    return { archivoId, rutaCifrada, sha256: sha256Hex(buffer) };
}

/** Lee y descifra. Solo lo llaman los endpoints guardados (colegio-dueño + nuestro admin). */
export async function leerContrato(archivoId: string): Promise<Buffer> {
    const cifrado = await readFile(rutaContrato(archivoId));
    return descifrarBuffer(cifrado);
}

/**
 * Borra el archivo cifrado. Lo llama SOLO la purga DEMO (siembra) — NUNCA el
 * borrado operativo del colegio, que debe PRESERVAR el contrato por la retención
 * [ABOGADO] (decisión del CEO, SPEC-796 (c)). Idempotente.
 */
export async function eliminarContrato(archivoId: string): Promise<void> {
    await eliminarDocumentoCifrado(rutaContrato(archivoId));
}
