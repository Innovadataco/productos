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
import { logger } from "./logger";

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
export function descifrarTextoReporte(valor: string | null | undefined, contexto?: { reporteId?: string }): string {
    if (!valor || valor === MARCADOR_TEXTO_PURGADO) return valor ?? "";
    if (!isEncryptedValue(valor)) return valor;
    try {
        return decryptParameter(valor);
    } catch {
        // SPEC-520 (PA · DoS): aislamiento por fila. Una fila que NO descifra no tumba
        // la página — el descifrado va dentro de un `.map()` en la bandeja del operador
        // y una sola fila rota daba 500 para TODOS. Pero NO en silencio: se registra CON
        // el id de la fila y NUNCA el contenido ni el valor. Dos casos se ven iguales:
        // fila legada en claro con forma `enc:{…}` (valor = texto real del denunciante)
        // vs ciphertext corrupto (llave/truncado, que le mostraría al operador el sobre
        // crudo como si fuera el texto). El log lo hace visible en vez de callado — la
        // degradación silenciosa es justo el patrón que estamos sacando.
        // TRANSITORIO: tolera porque HOY convive con filas legadas de la ventana de
        // migración. El lector ESTRICTO de la mudanza del texto (S-C) tiene contrato
        // duro y LANZA; este NO — y se retira cuando la migración termine.
        logger.error("descifrarTextoReporte: fila no descifrable (aislada, no tumba la página)", {
            reporteId: contexto?.reporteId ?? "desconocido",
        });
        return valor;
    }
}

/**
 * Valor listo para persistir cifrado. Idempotente: si ya viene cifrado (o es el
 * marcador), se devuelve sin re-cifrar (sin doble cifrado, O-3).
 */
export function cifrarTextoReporte(plain: string): string {
    // SPEC-520 (PA · DoS): el cifrado de entrada es INCONDICIONAL — NUNCA se decide
    // por la FORMA del texto del usuario. Un denunciante que escriba `enc:{…}` no
    // puede guardarse en claro (lo confundía `isEncryptedValue` con un ciphertext y
    // lo devolvía tal cual; después toda lectura tronaba). El ÚNICO valor que no se
    // cifra es el marcador de purga: es una marca del SISTEMA, no contenido del
    // usuario. Todos los callers pasan texto plano (input del formulario o valor ya
    // descifrado), nunca un ciphertext: no hay riesgo de doble cifrado.
    if (plain === MARCADOR_TEXTO_PURGADO) return plain;
    return encryptParameter(plain);
}

/** Update de purga D4: el texto queda como marcador constante no-identificable. */
export function purgaTextoReporte(): string {
    return MARCADOR_TEXTO_PURGADO;
}
