/**
 * SPEC-211 (002-PI-111): cálculos puros de la renovación de suscripción.
 * Sin dependencias de Prisma ni E/S; fácilmente testeable (tests unitarios).
 */
import { toZonedTime } from "date-fns-tz";
import { differenceInCalendarDays } from "date-fns";

const ZONA_BOGOTA = "America/Bogota";

function redondear2(valor: number): number {
    return Math.round(valor * 100) / 100;
}

/**
 * Descuento por duración anual (MES_12): porcentaje sobre el precio base.
 * Fuera de MES_12 no aplica (el llamador pasa pct=0).
 */
export function calcularDescuentoAnualUSD(montoBaseUSD: number, descuentoAnualPct: number): number {
    if (!Number.isFinite(montoBaseUSD) || montoBaseUSD <= 0) return 0;
    if (!Number.isFinite(descuentoAnualPct) || descuentoAnualPct <= 0) return 0;
    const pct = Math.min(descuentoAnualPct, 100);
    return redondear2((montoBaseUSD * pct) / 100);
}

export interface DescuentosInput {
    /** Precio base tras descuento anual (sobre este se calculan los demás). */
    baseUSD: number;
    /** Suma de descuentos de bonos pre-aplicados a la suscripción. */
    descuentoBonosUSD: number;
    /** Descuento por código de referido aplicado en esta renovación. */
    descuentoReferidoUSD: number;
    /**
     * true si TODOS los bonos aplicados son combinables con código personal.
     * Si alguno no lo es, se aplica el mayor entre bonos y referido (regla
     * `aplicarMayorDescuento` de SPEC-216), nunca la suma.
     */
    todosBonosCombinables: boolean;
}

/**
 * Resuelve el descuento total y el monto neto de la renovación. Nunca negativo
 * y nunca superior a la base.
 */
export function resolverDescuentoTotal(input: DescuentosInput): {
    descuentoTotalUSD: number;
    montoNetoUSD: number;
} {
    const base = Number.isFinite(input.baseUSD) && input.baseUSD > 0 ? input.baseUSD : 0;
    const bonos = Number.isFinite(input.descuentoBonosUSD) ? Math.max(0, input.descuentoBonosUSD) : 0;
    const referido = Number.isFinite(input.descuentoReferidoUSD) ? Math.max(0, input.descuentoReferidoUSD) : 0;

    const total = input.todosBonosCombinables ? bonos + referido : Math.max(bonos, referido);
    const descuentoTotalUSD = redondear2(Math.min(base, total));
    return { descuentoTotalUSD, montoNetoUSD: redondear2(base - descuentoTotalUSD) };
}

/**
 * Días calendario restantes hasta `fechaFin` con aritmética America/Bogota
 * (tanto "hoy" como el corte se llevan al calendario Bogotá antes de restar).
 * Negativo si ya venció.
 */
export function calcularDiasRestantesBogota(fechaFin: Date, ahora: Date = new Date()): number {
    const finBogota = toZonedTime(fechaFin, ZONA_BOGOTA);
    const hoyBogota = toZonedTime(ahora, ZONA_BOGOTA);
    return differenceInCalendarDays(finBogota, hoyBogota);
}

/** Año calendario Bogotá (clave de planes por año). */
export function anioBogota(ahora: Date = new Date()): number {
    return toZonedTime(ahora, ZONA_BOGOTA).getFullYear();
}
