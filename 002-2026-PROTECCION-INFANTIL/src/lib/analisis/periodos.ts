/**
 * SPEC-220 (002-PI-121): helpers de períodos del dominio Análisis.
 * El negocio opera en America/Bogota (D-69): los períodos mensuales son
 * strings "YYYY-MM" calculados con día calendario Bogotá, y los rangos de
 * fechas de un período se convierten a instantes UTC para las queries.
 * Usa `date-fns-tz` (dependencia ya usada por el módulo de pagos).
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const ZONA_BOGOTA = "America/Bogota";

const PATRON_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Valida el formato "YYYY-MM" de un período. */
export function esPeriodoValido(periodo: string): boolean {
    return PATRON_PERIODO.test(periodo);
}

/** Período "YYYY-MM" del mes calendario Bogotá que contiene `ahora`. */
export function periodoActualBogota(ahora: Date = new Date()): string {
    return formatInTimeZone(ahora, ZONA_BOGOTA, "yyyy-MM");
}

/**
 * Rango `[desde, hasta)` en instantes UTC que cubre el mes calendario Bogotá
 * del período "YYYY-MM". `desde` = día 1 a las 00:00 Bogotá; `hasta` = día 1
 * del mes siguiente a las 00:00 Bogotá.
 */
export function rangoMesBogota(periodo: string): { desde: Date; hasta: Date } {
    if (!esPeriodoValido(periodo)) {
        throw new Error(`Período inválido (esperado "YYYY-MM"): ${periodo}`);
    }
    const [anio, mes] = periodo.split("-").map((p) => parseInt(p, 10)) as [number, number];
    const desde = fromZonedTime(`${periodo}-01T00:00:00`, ZONA_BOGOTA);
    const mesSiguiente = mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, "0")}`;
    const hasta = fromZonedTime(`${mesSiguiente}-01T00:00:00`, ZONA_BOGOTA);
    return { desde, hasta };
}

/**
 * Período límite de retención: el "YYYY-MM" del mes Bogotá que quedó fuera de
 * la ventana (mes actual menos `retencionMeses`). Los snapshots con
 * `periodo < periodoLimite` se purgan (comparación lexicográfica válida por
 * formato). Con `retencionMeses = 24` y mes actual 2026-08, el límite es
 * 2024-08: se conservan los períodos >= 2024-08 (24 meses de ventana).
 */
export function periodoLimiteRetencion(retencionMeses: number, ahora: Date = new Date()): string {
    const actual = periodoActualBogota(ahora);
    const [anio, mes] = actual.split("-").map((p) => parseInt(p, 10)) as [number, number];
    const indice = anio * 12 + (mes - 1) - retencionMeses;
    const anioLimite = Math.floor(indice / 12);
    const mesLimite = (indice % 12) + 1;
    return `${anioLimite}-${String(mesLimite).padStart(2, "0")}`;
}
