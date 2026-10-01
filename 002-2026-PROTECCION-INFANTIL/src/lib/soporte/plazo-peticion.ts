/**
 * SPEC-752 · Término de la petición de servicio (PQR), POR MOTIVO, en UN solo lugar.
 *
 * El motivo decide el plazo, pero el plazo NO vive en el enum: el mapa
 * `PLAZO_POR_MOTIVO` es la fuente ÚNICA (decisión CEO). Si mañana la ley cambia un
 * término, se toca ACÁ, no un `switch` repartido. `venceEn` se calcula siempre
 * desde este mapa con el calculador de SPEC-768 (una sola noción de día hábil;
 * festivos Colombia).
 *
 * Cada entrada dice si es LEGAL o INTERNA — la marca importa: un término interno lo
 * cambia producto; uno LEGAL no se toca sin cambiar la ley. Son DOS legales con
 * plazos DISTINTOS + tres internos:
 *  - DATOS_PERSONALES (habeas data, Ley 1581): 10 = el más corto de consulta(10)/
 *    reclamo(15). Responder en 10 satisface AMBOS y NUNCA cae del lado que incumple
 *    (vencer tarde es inaceptable; vencer antes solo nos cuesta a nosotros). COSTO
 *    DECLARADO (CEO): un reclamo se marcará «tarde» desde el día 11 teniendo hasta
 *    el 15 — RUIDO INTERNO, no incumplimiento. NO subir a 15 «optimizando»: ahí gana
 *    el riesgo legal. El refinamiento consulta/reclamo es de SPEC-772 (por copy).
 *  - PAGO_O_COBRO (reversión del pago, Decreto 1074/2015 art. 51): 15 hábiles DESDE
 *    el reclamo. Este motivo recibe los reclamos de reembolso que migran del contacto
 *    directo con el profesional — un correo directo NO deja constancia de CUÁNDO
 *    reclamó el padre, y sin esa fecha el término legal no se puede contar; esta fila
 *    lo hace medible.
 *  - CITA / SERVICIO_PLATAFORMA / OTRA: término INTERNO de 5 días hábiles (no legal),
 *    no visible al padre en v1 (existe para ver qué se vence, no como promesa).
 */
import { sumarDiasHabilesColombia } from "@/lib/fechas/dias-habiles-colombia";

/** Término interno del SLA (no legal); producto puede cambiarlo. Decisión CEO SPEC-752. */
export const PLAZO_INTERNO_DIAS_HABILES = 5;

export interface PlazoMotivo {
    readonly diasHabiles: number;
    /** LEGAL = fijado por norma (no se toca sin cambiar la ley); interno = de producto. */
    readonly legal: boolean;
}

/** Fuente ÚNICA motivo → plazo. Las keys son los valores del enum MotivoPeticionServicio. */
export const PLAZO_POR_MOTIVO: Readonly<Record<string, PlazoMotivo>> = {
    DATOS_PERSONALES: { diasHabiles: 10, legal: true }, // Ley 1581 (el más corto de 10/15)
    PAGO_O_COBRO: { diasHabiles: 15, legal: true }, // Decreto 1074/2015 art. 51 (reversión, desde el reclamo)
    CITA: { diasHabiles: PLAZO_INTERNO_DIAS_HABILES, legal: false },
    SERVICIO_PLATAFORMA: { diasHabiles: PLAZO_INTERNO_DIAS_HABILES, legal: false },
    OTRA: { diasHabiles: PLAZO_INTERNO_DIAS_HABILES, legal: false },
};

/**
 * Días hábiles del término del motivo. Un motivo no mapeado cae al interno (5): es
 * el MÁS CORTO, así que responder en 5 satisface cualquier término legal ≤ 15 —
 * nunca tarde. El candado de paridad exige que TODO valor del enum esté mapeado.
 */
export function plazoDeMotivoDiasHabiles(motivo: string): number {
    return PLAZO_POR_MOTIVO[motivo]?.diasHabiles ?? PLAZO_INTERNO_DIAS_HABILES;
}

/** ¿El término del motivo es LEGAL (fijado por norma)? Para no «optimizar» un plazo legal. */
export function motivoTieneTerminoLegal(motivo: string): boolean {
    return PLAZO_POR_MOTIVO[motivo]?.legal ?? false;
}

/**
 * `venceEn` de la petición según su motivo: `creadoEn` + los días hábiles del mapa.
 * Siempre > creadoEn (sostiene el CHECK `venceEn > creadoEn` de la migración).
 */
export function venceEnPeticionServicio(motivo: string, creadoEn: Date): Date {
    return sumarDiasHabilesColombia(creadoEn, plazoDeMotivoDiasHabiles(motivo));
}
