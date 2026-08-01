/**
 * SPEC-130 (BL-4): cifrado en reposo del texto del reporte.
 * Helper ÚNICO (sin segunda fuente): envuelve `param-encryption.ts` (AES-256-GCM,
 * misma clave `PARAM_ENCRYPTION_KEY`; la gestiona el CEO, BL-2).
 *
 * Reglas (O-3):
 * - Idempotente en lectura Y escritura: un valor ya cifrado nunca se re-cifra;
 *   un valor legado en claro se devuelve tal cual al leer (ventana de migración).
 * - El marcador de purga NO se cifra ni se descifra: es texto no-identificable
 *   por diseño (D4), se muestra tal cual en las vistas (O-2).
 */
import { encryptParameter, decryptParameter, isEncryptedValue } from "./param-encryption";

/** Marcador constante no-identificable de la política D4 (texto purgado). */
export const MARCADOR_TEXTO_PURGADO = "[contenido purgado]";

/** True si el valor almacenado es cifrado GCM (no texto plano). */
export function estaCifradoTextoReporte(valor: string | null | undefined): boolean {
    if (!valor || valor === MARCADOR_TEXTO_PURGADO) return false;
    return isEncryptedValue(valor);
}

/**
 * Texto plano para uso autorizado en la capa de datos.
 * - cifrado → descifra; - plano legado → tal cual (ventana de migración);
 * - marcador/nulo → tal cual (nunca intenta descifrar el marcador).
 */
export function descifrarTextoReporte(valor: string | null | undefined): string {
    if (!valor || valor === MARCADOR_TEXTO_PURGADO) return valor ?? "";
    if (!isEncryptedValue(valor)) return valor;
    return decryptParameter(valor);
}

/**
 * Valor listo para persistir cifrado. Idempotente: si ya viene cifrado (o es el
 * marcador), se devuelve sin re-cifrar (sin doble cifrado, O-3).
 */
export function cifrarTextoReporte(plain: string): string {
    if (plain === MARCADOR_TEXTO_PURGADO || isEncryptedValue(plain)) return plain;
    return encryptParameter(plain);
}

/** Update de purga D4: el texto queda como marcador constante no-identificable. */
export function purgaTextoReporte(): string {
    return MARCADOR_TEXTO_PURGADO;
}
