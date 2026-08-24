/**
 * SPEC-223 (002-PI-124): ventana de la semana operativa anterior (lunes-domingo)
 * en America/Bogota y periodo ISO ("YYYY-Wnn") para el digest semanal.
 *
 * Mismo algoritmo que `semanaAnteriorBogota` (`src/lib/motor/deriva.ts`), pero
 * con `date-fns-tz` (D-69: la aritmética de cortes de semana se hace con la
 * librería de zonas, nunca con `Date` nativo sobre hora local del servidor).
 * America/Bogota es UTC-5 todo el año (sin DST): restar múltiplos de 24 h en
 * milisegundos es exacto para saltos de semana.
 */
import { getISOWeek, getISOWeekYear } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { ZONA_BOGOTA } from "./periodos";

const DIA_MS = 24 * 60 * 60 * 1000;

export interface VentanaSemanal {
    /** Lunes 00:00 Bogotá de la semana medida (inclusive), como instante UTC. */
    desde: Date;
    /** Lunes 00:00 Bogotá de la semana siguiente (exclusive), como instante UTC. */
    hasta: Date;
    /** Semana ISO Bogotá de `desde`: "2026-W34". */
    periodo: string;
}

/**
 * Periodo ISO Bogotá ("YYYY-Wnn") de la fecha dada: el año y la semana se
 * calculan sobre el "reloj de pared" de America/Bogota (`toZonedTime`), así el
 * 31 de diciembre / 1 de enero caen en la semana ISO correcta (D-69).
 */
export function periodoSemanaISOBogota(fecha: Date): string {
    const zoned = toZonedTime(fecha, ZONA_BOGOTA);
    const anio = getISOWeekYear(zoned);
    const semana = getISOWeek(zoned);
    return `${anio}-W${String(semana).padStart(2, "0")}`;
}

/**
 * La semana operativa ANTERIOR completa: `[lunes pasado 00:00, lunes actual
 * 00:00)` en America/Bogota, con el `periodo` ISO derivado de `desde`. Es la
 * ventana que mide el cron del lunes (un pago del domingo 23:59 Bogotá cuenta
 * en la semana que cierra; uno del lunes 00:01 ya no).
 */
export function ventanaSemanaAnteriorBogota(ahora: Date = new Date()): VentanaSemanal {
    const zoned = toZonedTime(ahora, ZONA_BOGOTA);
    const diasDesdeLunes = (zoned.getDay() + 6) % 7; // lunes=0 … domingo=6
    const medianocheHoy = fromZonedTime(
        `${formatInTimeZone(ahora, ZONA_BOGOTA, "yyyy-MM-dd")}T00:00:00`,
        ZONA_BOGOTA
    );
    const hasta = new Date(medianocheHoy.getTime() - diasDesdeLunes * DIA_MS);
    const desde = new Date(hasta.getTime() - 7 * DIA_MS);
    return { desde, hasta, periodo: periodoSemanaISOBogota(desde) };
}
