/**
 * SPEC-237 (002-PI-mega-cola): helpers de SLA de la bandeja del comité.
 * El SLA se calcula como `creadoEn + horas` y se muestra SIEMPRE en zona
 * `America/Bogota` (D7), con semáforo pino/ambar/rubi (D8):
 * - rubi: fecha límite ya vencida.
 * - ambar: faltan menos de 24 h para vencer.
 * - pino: resto de casos.
 */
import { formatInTimeZone } from "date-fns-tz";

export const ZONA_BOGOTA = "America/Bogota";
export const UMBRAL_AMBAR_HORAS = 24;

export type ColorSla = "pino" | "ambar" | "rubi";

export interface SlaInfo {
    /** Fecha límite en ISO 8601 con offset de Bogotá (para mostrar en UI). */
    fechaLimite: string;
    color: ColorSla;
    vencido: boolean;
}

const HORA_MS = 60 * 60 * 1000;

/** Fecha límite del SLA: creación + N horas (instante absoluto, sin zona). */
export function calcularFechaLimiteSla(creadoEn: Date, horas: number): Date {
    return new Date(creadoEn.getTime() + horas * HORA_MS);
}

/** Semáforo del SLA frente a `ahora`. */
export function colorIndicadorSla(fechaLimite: Date, ahora: Date = new Date()): ColorSla {
    const restanteMs = fechaLimite.getTime() - ahora.getTime();
    if (restanteMs < 0) return "rubi";
    if (restanteMs < UMBRAL_AMBAR_HORAS * HORA_MS) return "ambar";
    return "pino";
}

/** Fecha/hora formateada en Bogotá para mostrar en la bandeja. */
export function formatearEnBogota(fecha: Date): string {
    return formatInTimeZone(fecha, ZONA_BOGOTA, "yyyy-MM-dd HH:mm");
}

/** DTO de SLA completo para una tarea de la bandeja. */
export function construirSla(creadoEn: Date, horas: number, ahora: Date = new Date()): SlaInfo {
    const fechaLimite = calcularFechaLimiteSla(creadoEn, horas);
    const color = colorIndicadorSla(fechaLimite, ahora);
    return {
        fechaLimite: formatInTimeZone(fechaLimite, ZONA_BOGOTA, "yyyy-MM-dd'T'HH:mm:ssXXX"),
        color,
        vencido: color === "rubi",
    };
}
