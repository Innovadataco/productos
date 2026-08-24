/**
 * SPEC-225 (002-PI-126): comparativa semanal pura de las reglas de crecimiento
 * anómalo, uso caído y caída de recaudo. Sin división por cero: si la semana
 * de referencia no alcanza la base mínima parametrizable, la regla NO evalúa
 * ese sujeto (edge case "semanas con base cero" del spec) y el motivo queda
 * documentado para `datosContexto`.
 */

export type DireccionComparativa = "CRECIMIENTO" | "CAIDA";

export interface ResultadoComparativa {
    /** false cuando la base de referencia es insuficiente (no se emite veredicto). */
    evaluable: boolean;
    /** Variación porcentual redondeada a 2 decimales; null si no evaluable. */
    variacionPct: number | null;
    dispara: boolean;
    motivoOmision: "base_insuficiente" | null;
}

/**
 * Evalúa `actual` vs `anterior` con umbral porcentual:
 * - `CRECIMIENTO`: dispara si la variación supera `umbralPct` (estricto).
 * - `CAIDA`: dispara si la variación cae por debajo de `-umbralPct` (estricto).
 */
export function evaluarComparativaSemanal(
    actual: number,
    anterior: number,
    umbralPct: number,
    baseMinima: number,
    direccion: DireccionComparativa
): ResultadoComparativa {
    if (anterior < baseMinima) {
        return { evaluable: false, variacionPct: null, dispara: false, motivoOmision: "base_insuficiente" };
    }
    const variacionPct = Math.round(((actual - anterior) / anterior) * 10000) / 100;
    const dispara =
        direccion === "CRECIMIENTO" ? variacionPct > umbralPct : variacionPct < -umbralPct;
    return { evaluable: true, variacionPct, dispara, motivoOmision: null };
}
