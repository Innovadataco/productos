/**
 * SPEC-238 (002-PI-mega-cola): helpers puros del SLA de la aclaración
 * padre-comité (sin BD). La zona horaria del negocio es America/Bogota
 * (misma convención del motor, SPEC-236): como el SLA se mide en horas
 * enteras, la suma es invariante a la zona; el worker corre con
 * TZ=America/Bogota.
 */

/** Instante límite de solicitud: aclaraciones con `solicitadaEn` anterior a
 *  este instante tienen el SLA vencido en `ahora`. */
export function calcularLimiteSolicitudSla(ahora: Date, slaHoras: number): Date {
    return new Date(ahora.getTime() - slaHoras * 3_600_000);
}

/** True si `solicitadaEn + slaHoras` ya venció en `ahora`. */
export function aclaracionSlaVencida(solicitadaEn: Date, slaHoras: number, ahora: Date): boolean {
    return solicitadaEn.getTime() + slaHoras * 3_600_000 < ahora.getTime();
}
