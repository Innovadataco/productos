/**
 * SPEC-753 · Estado EFECTIVO de un incidente de contradicción de encuesta — el
 * que resulta de contar el paso del tiempo contra el plazo legal (REPORTE-070).
 *
 * Mismo patrón que `estadoEfectivoDeCita` (#718): el plazo (`venceEn`) VIVE en
 * la columna —contable por query, nadie lo ignora sin que se vea— y el estado
 * se DERIVA, no se persiste. Así el «venció sin resolver → a favor del padre»
 * salta SOLO al cruzar la fecha, sin que ninguna persona lo decida.
 *
 * Contrato:
 *  - PURO. No toca tablas. `now` INYECTABLE (sin reloj de pared adentro).
 *  - `RESUELTO` es SOLO la resolución EN PLAZO (`resueltoEn <= venceEn`): eso es
 *    cumplimiento. Una resolución POSTERIOR al vencimiento NO es cumplimiento —
 *    la obligación de reversar ya se disparó al vencer y resolver tarde no la
 *    deshace (RIESGO señalado por el CEO): cae en `RESUELTO_TARDE`, que NO puede
 *    presentarse como «esto quedó bien».
 *  - Sin resolver: `now >= venceEn` → `VENCIDO_A_FAVOR_PADRE`; si no → `ABIERTO`.
 *  - Fallo conservador: con `now`/`venceEn` ausente o basura NUNCA se afirma
 *    cumplimiento ni se deja `ABIERTO`; cae al lado que PROTEGE al padre
 *    (`RESUELTO_TARDE` si había resolución que no se puede probar a tiempo,
 *    `VENCIDO_A_FAVOR_PADRE` si no). Dejarlo `ABIERTO`/`RESUELTO` sería el
 *    «caduca en silencio» que la ley reprocha.
 *
 * `esIncumplimiento` es la fuente ÚNICA de «la obligación se disparó»: TODO
 * conteo de incumplimientos debe usarla (incluye `RESUELTO_TARDE`, no solo
 * `VENCIDO_A_FAVOR_PADRE`), para que resolver tarde no se escape del recuento.
 *
 * La ACCIÓN de reversar el pago NO es de esta derivación (otra SPEC).
 */

/** Entrada temporal tolerante: Date de Prisma, ISO string, epoch ms, o ausente. */
export type EntradaTiempoIncidente = Date | string | number | null | undefined;

/** Estado efectivo del incidente. NO se persiste: se deriva del reloj. */
export type EstadoIncidenteContradiccion =
    | "ABIERTO"
    | "RESUELTO"
    | "RESUELTO_TARDE"
    | "VENCIDO_A_FAVOR_PADRE";

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
    const resuelto = aEpochMs(resueltoEn);
    const vence = aEpochMs(venceEn);
    const ahora = aEpochMs(now);

    if (resuelto !== null) {
        // RESUELTO solo si es COMPROBABLEMENTE a tiempo (plazo válido y resuelto ≤ plazo).
        // Resuelto después del plazo, o plazo no confiable → RESUELTO_TARDE (no es cumplimiento).
        return vence !== null && resuelto <= vence ? "RESUELTO" : "RESUELTO_TARDE";
    }

    // Sin resolver: con reloj no confiable NO lo dejamos ABIERTO (sería «caduca en
    // silencio»); cae al lado que protege al padre.
    if (vence === null || ahora === null) return "VENCIDO_A_FAVOR_PADRE";
    return ahora >= vence ? "VENCIDO_A_FAVOR_PADRE" : "ABIERTO";
}

/**
 * Fuente ÚNICA de «la obligación de reversar se disparó» (el incumplimiento).
 * Ratificado como decisión por el CEO: cuando alguien deba responder «¿cuántas
 * veces incumplimos?» —en un reclamo o una auditoría, y va a pasar— la respuesta
 * NO puede depender de que cada consumidor recuerde incluir `RESUELTO_TARDE`.
 * NADIE cuenta incumplimientos comparando estados a mano: se le pregunta a ESTA
 * función. Incluye `RESUELTO_TARDE` (una resolución posterior al vencimiento
 * sigue siendo incumplimiento); olvidarlo SUBESTIMA el incumplimiento, que es la
 * dirección peligrosa.
 */
export function esIncumplimiento(estado: EstadoIncidenteContradiccion): boolean {
    return estado === "VENCIDO_A_FAVOR_PADRE" || estado === "RESUELTO_TARDE";
}
