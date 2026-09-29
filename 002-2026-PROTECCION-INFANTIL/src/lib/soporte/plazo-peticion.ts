/**
 * SPEC-752 · Término INTERNO de la petición de servicio (PQR).
 *
 * `venceEn = creadoEn + 5 días hábiles`, con el calculador de SPEC-768 (una sola
 * noción de día hábil en el producto; festivos Colombia + fin del bug de tipos).
 *
 * El término es INTERNO (decisión del CEO): existe para que veamos qué se está
 * venciendo, NO se le muestra al padre en v1 ni se promete en pantalla — no
 * tenemos historial de cumplirlo, y prometer un plazo sin haberlo verificado es
 * justo lo que no hacemos. Cuando haya historia, Diseño decide si se muestra.
 *
 * NO confundir con el término LEGAL de habeas data (Ley 1581, 10/15 hábiles): eso
 * es SPEC-772, con su propia puerta rotulada.
 */
import { sumarDiasHabilesColombia } from "@/lib/fechas/dias-habiles-colombia";

/** Término interno del SLA de PQR, en días HÁBILES (no legal). Decisión CEO SPEC-752. */
export const PLAZO_INTERNO_PETICION_DIAS_HABILES = 5;

/** `venceEn` de la petición: `creadoEn` + 5 hábiles. Siempre > creadoEn (sostiene el CHECK). */
export function venceEnPeticionServicio(creadoEn: Date): Date {
    return sumarDiasHabilesColombia(creadoEn, PLAZO_INTERNO_PETICION_DIAS_HABILES);
}
