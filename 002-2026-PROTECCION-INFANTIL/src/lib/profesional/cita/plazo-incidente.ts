/**
 * SPEC-753 · Término del incidente de contradicción, POR CLASE, en UN solo lugar.
 *
 * El incidente es SIMÉTRICO (decisión CEO): el plazo depende de QUIÉN afirmó la
 * no-prestación, igual que en 752 el plazo depende del motivo. El mapa `PLAZO_POR_CLASE`
 * es la fuente ÚNICA; cada entrada dice si es LEGAL o INTERNA, y el LEGAL queda clavado
 * por candado (no se «optimiza»). `venceEn` se calcula desde el ancla que fija cada clase,
 * con el calculador de SPEC-768.
 *
 *  - NO_PRESTACION_RECLAMO_PADRE (el PADRE dice que no se realizó, el profesional que sí):
 *    hay reclamo del CONSUMIDOR sobre un servicio que pagó → término LEGAL de reversión
 *    (Decreto 1074/2015 art. 51, 15 días hábiles DESDE el reclamo). El ancla es la
 *    `respondidaEn` del padre: SU respuesta ES el reclamo. Ni la fecha de la cita (el
 *    reloj correría antes de existir reclamo) ni la detección (nos daría más tiempo del
 *    que el reclamo justifica).
 *  - NO_PRESTACION_DICHA_PROFESIONAL (el PROFESIONAL dice que no, el padre que sí): NO
 *    hay reclamo del consumidor (nadie pide reversión) → término INTERNO, anclado en la
 *    detección. Hay que resolver la contradicción, pero con NUESTRO término, no el legal.
 *  - DISCREPANCIA_SERVICIO (ambos coinciden en que se realizó pero difieren en un detalle
 *    de servicio): no hay no-prestación ni reclamo de reversión → término INTERNO.
 */
import { sumarDiasHabilesColombia } from "@/lib/fechas/dias-habiles-colombia";

/** LEGAL (Decreto 1074/2015 art. 51): reversión del pago, 15 días hábiles desde el reclamo. */
export const PLAZO_REVERSION_DIAS_HABILES = 15;
/**
 * INTERNO (producto, cambiable): término propio para resolver una contradicción sin
 * reclamo. Deliberadamente DISTINTO del legal (decisión CEO): si compartieran el 15,
 * un candado que afirma «el legal es 15» pasaría igual con la constante equivocada
 * (pierde poder de discriminación), una «simplificación» fusionaría ambos sin ponerse
 * rojo, y un cambio de la ley arrastraría el interno en silencio. 10 < 15: el interno
 * cae ANTES, con holgura, y nunca a la par del vencimiento del padre.
 */
export const PLAZO_INTERNO_INCIDENTE_DIAS_HABILES = 10;

/** La clase de la contradicción decide el término. Determinada por quién afirmó la no-prestación. */
export type ClaseContradiccion =
    | "NO_PRESTACION_RECLAMO_PADRE"
    | "NO_PRESTACION_DICHA_PROFESIONAL"
    | "DISCREPANCIA_SERVICIO";

/** De dónde sale `reclamadoEn` (el ancla del término). */
export type AnclaIncidente = "PADRE_RESPONDIO" | "DETECCION";

export interface PlazoIncidente {
    readonly diasHabiles: number;
    /** LEGAL = fijado por norma (no se toca sin cambiar la ley); interno = de producto. */
    readonly legal: boolean;
    readonly ancla: AnclaIncidente;
}

/** Fuente ÚNICA clase → término. El candado exige que TODA clase esté mapeada. */
export const PLAZO_POR_CLASE: Readonly<Record<ClaseContradiccion, PlazoIncidente>> = {
    NO_PRESTACION_RECLAMO_PADRE: { diasHabiles: PLAZO_REVERSION_DIAS_HABILES, legal: true, ancla: "PADRE_RESPONDIO" },
    NO_PRESTACION_DICHA_PROFESIONAL: { diasHabiles: PLAZO_INTERNO_INCIDENTE_DIAS_HABILES, legal: false, ancla: "DETECCION" },
    DISCREPANCIA_SERVICIO: { diasHabiles: PLAZO_INTERNO_INCIDENTE_DIAS_HABILES, legal: false, ancla: "DETECCION" },
};

/** ¿El término de esta clase es LEGAL (fijado por norma)? Para no «optimizar» un plazo legal. */
export function claseTieneTerminoLegal(clase: ClaseContradiccion): boolean {
    return PLAZO_POR_CLASE[clase].legal;
}

/**
 * `reclamadoEn` de un incidente según su clase: la `respondidaEn` del padre para el
 * término legal (su respuesta es el reclamo), o la detección para los internos.
 *
 * Las dos fechas van POR OBJETO a propósito (no dos `Date` posicionales): invertirlas
 * COMPILARÍA y anclaría el término LEGAL en la detección en vez de en el reclamo del padre
 * — un vencimiento calculado desde la fecha equivocada, en silencio, sobre un plazo de ley,
 * y hacia el lado que nos da MÁS tiempo del que tenemos. El objeto lo vuelve imposible.
 */
export function reclamadoEnDeClase(clase: ClaseContradiccion, fechas: { padreRespondioEn: Date; deteccion: Date }): Date {
    return PLAZO_POR_CLASE[clase].ancla === "PADRE_RESPONDIO" ? fechas.padreRespondioEn : fechas.deteccion;
}

/**
 * `venceEn` del incidente: `reclamadoEn` + los días hábiles del mapa. Siempre > reclamadoEn
 * (sostiene el CHECK VALIDADO `venceEn > reclamadoEn`).
 */
export function venceEnIncidente(clase: ClaseContradiccion, reclamadoEn: Date): Date {
    return sumarDiasHabilesColombia(reclamadoEn, PLAZO_POR_CLASE[clase].diasHabiles);
}
