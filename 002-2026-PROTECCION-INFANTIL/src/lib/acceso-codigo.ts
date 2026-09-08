import { createHash, randomInt } from "crypto";

/**
 * SPEC-584 (Fase 3) · Código temporal de acceso externo al texto del reporte.
 *
 * El código se genera con el CSPRNG de Node sobre un alfabeto SIN caracteres
 * ambiguos (sin 0/O ni 1/I: no se distinguen a mano ni por teléfono). En reposo
 * vive SOLO `hashCodigoAcceso` (sha-256); el plano se muestra una sola vez al
 * padre que lo solicitó (pantalla + correo) y se pasa de voz/papel al profesional.
 */

// 32 símbolos: A–Z y 2–9 sin O ni I.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const LONGITUD_CODIGO = 8;

/** Genera un código de acceso de 8 caracteres sin ambigüedades. */
export function generarCodigoAcceso(): string {
    let codigo = "";
    for (let i = 0; i < LONGITUD_CODIGO; i++) {
        codigo += ALFABETO[randomInt(ALFABETO.length)];
    }
    return codigo;
}

/** Normaliza lo que digita el usuario: mayúsculas, sin espacios intermedios. */
export function normalizarCodigoAcceso(crudo: string): string {
    return crudo.trim().toUpperCase().replace(/\s+/g, "");
}

/** sha-256 hex del código/token. Es lo único que se persiste en reposo. */
export function hashCodigoAcceso(valor: string): string {
    return createHash("sha256").update(valor, "utf8").digest("hex");
}

/** sha-256 hex de un texto descifrado visto (auditoría de lectura, nunca el texto). */
export function hashContenidoVisto(texto: string): string {
    return createHash("sha256").update(texto, "utf8").digest("hex");
}
