/**
 * SPEC-772 · FUENTE ÚNICA del estado EFECTIVO de una solicitud de habeas data — el que resulta de
 * contar el paso del tiempo contra el término LEGAL (Ley 1581 arts. 14-15: 10/15 días hábiles).
 *
 * El defecto que evita: resolver una solicitud DESPUÉS de `venceEn` no es «resuelta» — es
 * «resuelta TARDE», y esa distinción es la que prueba un incumplimiento legal. Un conteo que mire
 * solo `estado` (crudo) pierde las tardías; el resumen diría «al día» sobre un detalle vencido.
 * Por eso `esIncumplimiento` es fuente única y el resumen y el detalle DEBEN leerla igual (D-4).
 *
 * Espejo de `estadoEfectivoDeCita` (SPEC-746/#718): derivación PURA, `now` INYECTABLE, sin reloj de
 * pared adentro. Falla hacia el LADO CONSERVADOR = el INCUMPLIMIENTO (nunca esconde una tardía ni
 * una vencida): dato ausente/basura → se cuenta como incumplida, no como al día. El defecto no
 * puede disfrazarse de éxito. NO necesita el `estado` de negocio: la verdad está en las FECHAS
 * (`venceEn` NOT NULL por el modelo, `resueltaEn` cuando se resolvió, `now`).
 */

/** Entrada temporal tolerante: Date de Prisma, ISO string, epoch ms, o ausente. */
export type EntradaTiempo = Date | string | number | null | undefined;

/**
 * Estado efectivo respecto del término legal. `RESUELTA_TARDE` y `VENCIDA_SIN_RESOLVER` son
 * incumplimiento; los dos se conservan para que ningún conteo los pierda.
 */
export type EstadoEfectivoSolicitud =
    | "EN_TERMINO"
    | "VENCIDA_SIN_RESOLVER"
    | "RESUELTA_A_TIEMPO"
    | "RESUELTA_TARDE";

/** Normaliza a epoch ms, o `null` si es ausente/basura (la compuerta del fallo conservador). */
function aEpochMs(v: EntradaTiempo): number | null {
    if (v === null || v === undefined) return null;
    const ms = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
}

/**
 * El estado EFECTIVO de una solicitud, contando el paso del tiempo contra `venceEn`.
 *
 * @param venceEn    plazo legal (Date/ISO/epoch ms) — NOT NULL en el modelo; basura → conservador.
 * @param resueltaEn instante de resolución, o ausente si sigue abierta.
 * @param now        instante de referencia INYECTADO. Ausente/basura → conservador (incumplida).
 */
export function estadoEfectivoSolicitud(
    venceEn: EntradaTiempo,
    resueltaEn: EntradaTiempo,
    now: EntradaTiempo,
): EstadoEfectivoSolicitud {
    const vence = aEpochMs(venceEn);
    const resuelta = aEpochMs(resueltaEn);

    if (resuelta !== null) {
        // Resuelta: ¿a tiempo o tarde? Sin `venceEn` válido no podemos probar que fue a tiempo →
        // conservador = TARDE (no se le regala «a tiempo» a una fila sin plazo verificable).
        if (vence === null) return "RESUELTA_TARDE";
        return resuelta <= vence ? "RESUELTA_A_TIEMPO" : "RESUELTA_TARDE";
    }

    // Abierta: ¿en término o vencida? `now`/`venceEn` ausente o basura → conservador = VENCIDA
    // (falla hacia el incumplimiento, nunca hacia «al día», que escondería el problema).
    const ahora = aEpochMs(now);
    if (vence === null || ahora === null) return "VENCIDA_SIN_RESOLVER";
    return ahora < vence ? "EN_TERMINO" : "VENCIDA_SIN_RESOLVER";
}

/**
 * ¿La solicitud incumple el término legal? FUENTE ÚNICA (D-4): el resumen (conteos) y el detalle la
 * leen IGUAL — una vencida-sin-resolver o una resuelta-tarde incumplen; nada más. Nunca se cuenta
 * por `estado` crudo en un lado y por el efectivo en el otro.
 */
export function esIncumplimiento(
    venceEn: EntradaTiempo,
    resueltaEn: EntradaTiempo,
    now: EntradaTiempo,
): boolean {
    const e = estadoEfectivoSolicitud(venceEn, resueltaEn, now);
    return e === "VENCIDA_SIN_RESOLVER" || e === "RESUELTA_TARDE";
}
