/**
 * SPEC-768 · Días hábiles de Colombia — fuente ÚNICA (reemplaza el cálculo sesgado
 * que vivía en `apelaciones.ts`, que `apelaciones` ahora DELEGA acá).
 *
 * El bug que originó esto era de TIPOS: mezclaba `Date.UTC` (medianoche UTC) con
 * `getDay` (ciego a zona) → contaba martes-sábado y un vencimiento podía caer TARDE
 * (peligroso: enmascara un incumplimiento). Acá la aritmética trabaja SOLO en FECHA
 * calendario de Bogotá; el instante se reconstituye una sola vez, al FINAL.
 *
 * REGLA (SPEC-768, confirmada por el CEO): el día del ANCLA no cuenta (el término
 * corre desde el día hábil SIGUIENTE); si el ancla cae en fin de semana o festivo,
 * el conteo arranca igual en el siguiente hábil. El instante del vencimiento es el
 * FIN del día hábil N.º — 23:59:59.999 America/Bogota (criterio legal del CEO): la
 * ley da los 15 días hábiles COMPLETOS, así que el borde es el final del 15.º.
 *
 * ⚠️ Toda lógica de día-de-semana / hábil / vencimiento pasa por ESTE módulo. Un
 * `getDay`/`new Date()` crudo en un sitio de lectura reintroduce el bug — por eso
 * el candado prohíbe el cálculo de día hábil fuera de acá.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { esFestivoColombia, isoCalendario } from "./festivos-colombia";

const TZ = "America/Bogota";

/** `yyyy-mm-dd` de Bogotá de un instante (consciente de zona, correcto). */
export function diaBogota(fecha: Date): string {
    return formatInTimeZone(fecha, TZ, "yyyy-MM-dd");
}

/** Portador de una fecha calendario `yyyy-mm-dd`: mediodía UTC (sin aliasing). */
function portador(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

/** Instante del FIN del día calendario de Bogotá (23:59:59.999). */
export function finDeDiaHabilBogota(iso: string): Date {
    return fromZonedTime(`${iso}T23:59:59.999`, TZ);
}

/** ¿La fecha calendario `yyyy-mm-dd` es hábil? (no fin de semana ni festivo). */
export function esFechaHabilColombia(iso: string): boolean {
    const dow = portador(iso).getUTCDay(); // 0=domingo … 6=sábado
    if (dow === 0 || dow === 6) return false;
    return !esFestivoColombia(iso);
}

/** ¿El INSTANTE cae en un día hábil de Bogotá? */
export function esDiaHabilColombia(fecha: Date): boolean {
    return esFechaHabilColombia(diaBogota(fecha));
}

/**
 * Suma `dias` días hábiles a `desde` y devuelve el INSTANTE del FIN de ese día
 * hábil (23:59:59.999 Bogotá). El día del ancla no cuenta.
 */
export function sumarDiasHabilesColombia(desde: Date, dias: number): Date {
    let cursor = portador(diaBogota(desde));
    let restantes = dias;
    while (restantes > 0) {
        cursor = new Date(cursor);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        if (esFechaHabilColombia(isoCalendario(cursor))) restantes -= 1;
    }
    return finDeDiaHabilBogota(isoCalendario(cursor));
}

/**
 * Días hábiles entre `desde` (EXCLUIDO) y `hasta` (INCLUIDO); 0 si `hasta` es el
 * mismo día calendario o anterior. Fines de semana y festivos no suman.
 */
export function diasHabilesTranscurridosColombia(desde: Date, hasta: Date): number {
    let cursor = portador(diaBogota(desde));
    const fin = portador(diaBogota(hasta));
    let count = 0;
    while (cursor.getTime() < fin.getTime()) {
        cursor = new Date(cursor);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        if (esFechaHabilColombia(isoCalendario(cursor))) count += 1;
    }
    return count;
}
