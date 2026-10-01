/**
 * SPEC-752 · Estado EFECTIVO de una petición de servicio (PQR), contando el reloj
 * del término interno. Mismo patrón que `estadoEfectivoIncidente` (SPEC-753/#718):
 * `venceEn` vive en la columna; el estado se DERIVA, no se persiste.
 *
 * `RESUELTA` es SOLO la resolución EN PLAZO (`resueltoEn <= venceEn`). Resuelta
 * DESPUÉS del vencimiento — o con `venceEn` no confiable — NO es cumplimiento:
 * cae en `RESUELTA_TARDE` (misma lección que el incidente: una resolución tardía
 * no puede presentarse como «resuelta»). Sin resolver: `now >= venceEn` →
 * `VENCIDA_SIN_RESOLVER`; si no → `ABIERTA`. Fallo conservador: `now`/`venceEn`
 * ausente o basura NUNCA deja `ABIERTA` ni afirma `RESUELTA` — cae del lado que
 * NO oculta un término vencido.
 *
 * `esPeticionIncumplida` es la fuente ÚNICA del conteo de incumplimientos del SLA
 * interno (incluye `RESUELTA_TARDE`): nadie los cuenta comparando estados a mano.
 */

export type EntradaTiempoPeticion = Date | string | number | null | undefined;

export type EstadoPeticionServicio = "ABIERTA" | "RESUELTA" | "RESUELTA_TARDE" | "VENCIDA_SIN_RESOLVER";

function aEpochMs(v: EntradaTiempoPeticion): number | null {
    if (v === null || v === undefined) return null;
    const ms = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
}

/**
 * @param resueltoEn cuándo se resolvió (o null/ausente si sigue sin resolver).
 * @param venceEn    el término interno (Date/ISO/epoch ms).
 * @param now        instante de referencia INYECTADO. Ausente/basura → conservador.
 */
export function estadoEfectivoPeticion(
    resueltoEn: EntradaTiempoPeticion,
    venceEn: EntradaTiempoPeticion,
    now: EntradaTiempoPeticion,
): EstadoPeticionServicio {
    const resuelto = aEpochMs(resueltoEn);
    const vence = aEpochMs(venceEn);
    const ahora = aEpochMs(now);

    if (resuelto !== null) {
        return vence !== null && resuelto <= vence ? "RESUELTA" : "RESUELTA_TARDE";
    }
    if (vence === null || ahora === null) return "VENCIDA_SIN_RESOLVER";
    return ahora >= vence ? "VENCIDA_SIN_RESOLVER" : "ABIERTA";
}

/**
 * Fuente ÚNICA de «se incumplió el término interno». Incluye `RESUELTA_TARDE`:
 * resolver tarde sigue siendo incumplimiento. Contar solo `VENCIDA_SIN_RESOLVER`
 * dejaría afuera las resueltas tarde — por eso el conteo se hace con esta función.
 */
export function esPeticionIncumplida(estado: EstadoPeticionServicio): boolean {
    return estado === "VENCIDA_SIN_RESOLVER" || estado === "RESUELTA_TARDE";
}
