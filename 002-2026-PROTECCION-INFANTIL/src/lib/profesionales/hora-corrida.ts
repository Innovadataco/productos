/**
 * SPEC-449 (I-313) · la hora del reloj de vencimiento, parametrizable.
 *
 * Función pura y con **default duro**: la hora sale de `ParametroSistema`, y si
 * el valor está vacío o mal escrito **no se rompe el worker ni se inventa una
 * hora rara** — cae a las 02:00 de Bogotá. Un cron mal formado no falla al
 * arrancar: falla en silencio no corriendo nunca, que es peor.
 *
 * Gemela deliberada de `horaCorridaACron` de `pagos/vigencia.service.ts`: misma
 * forma, **clave propia**. Reusar la de pagos ataría dos relojes de dominios
 * distintos al mismo parámetro, y el día que el admin mueva uno movería el otro
 * sin enterarse.
 *
 * Import relativo y sin dependencias a propósito (SPEC-197 · I-88): entra en la
 * cadena de un worker `.mjs`.
 */

/** 02:00 Bogotá — una hora después del corte de pagos, para no encimar corridas. */
export const CRON_POR_DEFECTO = "0 2 * * *";

const HORA_VALIDA = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/**
 * `"HH:MM"` → cron de cinco campos. Cualquier cosa que no sea una hora válida
 * devuelve el default, sin lanzar.
 */
export function horaCorridaACronVerificacion(valor: string | null | undefined): string {
    if (!valor) return CRON_POR_DEFECTO;
    const m = HORA_VALIDA.exec(valor.trim());
    if (!m) return CRON_POR_DEFECTO;
    const hora = Number.parseInt(m[1]!, 10);
    const minuto = Number.parseInt(m[2]!, 10);
    return `${minuto} ${hora} * * *`;
}
