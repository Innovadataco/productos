/**
 * SPEC-753 · Estado EFECTIVO de un incidente de contradicción de encuesta — el
 * que resulta de contar el paso del tiempo contra el plazo legal (REPORTE-070).
 *
 * Mismo patrón que `estadoEfectivoDeCita` (#718): el plazo (`venceEn`) VIVE en
 * la columna —contable por query, nadie lo ignora sin que se vea— y el estado
 * se DERIVA, no se persiste. Así el «venció sin resolver → a favor del padre»
 * salta SOLO al cruzar la fecha, sin que ninguna persona lo decida: nadie se
 * puede sentar encima hasta que caduque.
 *
 * Contrato:
 *  - PURO. No toca tablas. `now` INYECTABLE (sin reloj de pared adentro).
 *  - Un incidente RESUELTO (tiene `resueltoEn`) queda RESUELTO: la resolución es
 *    un hecho, no depende del reloj.
 *  - Sin resolver: `now >= venceEn` → VENCIDO_A_FAVOR_PADRE; si no → ABIERTO.
 *  - Fallo conservador: con `now` o `venceEn` ausente/basura, cae a
 *    VENCIDO_A_FAVOR_PADRE, NUNCA a ABIERTO. Acá «conservador» es **el lado que
 *    protege al padre**: dejar un incidente ABIERTO cuando no podemos leer el
 *    reloj es justo el «caduca en silencio» que la ley nos reprocha; el default
 *    legal es a favor del padre, así que el fallo también.
 *
 * La ACCIÓN de reversar el pago sobre un VENCIDO_A_FAVOR_PADRE NO es de esta
 * derivación (otra SPEC): acá solo se dice, sin ambigüedad, en qué estado está.
 */

/** Entrada temporal tolerante: Date de Prisma, ISO string, epoch ms, o ausente. */
export type EntradaTiempoIncidente = Date | string | number | null | undefined;

/** Estado efectivo del incidente. NO se persiste: se deriva del reloj. */
export type EstadoIncidenteContradiccion = "ABIERTO" | "RESUELTO" | "VENCIDO_A_FAVOR_PADRE";

/** epoch ms, o null si la entrada es ausente/basura (la compuerta del fallo conservador). */
function aEpochMs(v: EntradaTiempoIncidente): number | null {
    if (v === null || v === undefined) return null;
    const ms = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
}

/**
 * El estado efectivo del incidente, contando el paso del tiempo.
 *
 * @param resueltoEn cuándo se resolvió (o null/ausente si sigue sin resolver).
 * @param venceEn    el plazo legal de reversión (Date/ISO/epoch ms).
 * @param now        instante de referencia INYECTADO. Ausente/basura → conservador.
 */
export function estadoEfectivoIncidente(
    resueltoEn: EntradaTiempoIncidente,
    venceEn: EntradaTiempoIncidente,
    now: EntradaTiempoIncidente,
): EstadoIncidenteContradiccion {
    // La resolución es un hecho: si existe y es válida, gana sobre el reloj.
    if (aEpochMs(resueltoEn) !== null) return "RESUELTO";

    const vence = aEpochMs(venceEn);
    const ahora = aEpochMs(now);
    // Sin reloj confiable, NO lo dejamos ABIERTO (sería el «caduca en silencio»):
    // cae al lado que protege al padre.
    if (vence === null || ahora === null) return "VENCIDO_A_FAVOR_PADRE";

    return ahora >= vence ? "VENCIDO_A_FAVOR_PADRE" : "ABIERTO";
}
