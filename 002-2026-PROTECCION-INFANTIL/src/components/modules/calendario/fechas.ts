/**
 * SPEC-714/730 · Constantes y helpers puros de la rejilla del calendario, COMPARTIDOS
 * por el profesional (publica/responde) y el padre (elige franja / ve sus citas).
 *
 * Voz NEUTRA a propósito: este módulo vive fuera de `profesional/` y de `padre/` — no
 * lleva copy de «usted» ni de «tú», solo geometría y fechas civiles de Bogotá (mediodía
 * UTC nunca cruza el día). La conversión hora-de-pared → instante sigue viviendo aparte,
 * por `instanteDesdeHoraBogota` (I-247 · D-69); acá solo se proyecta un ISO a su posición
 * en la rejilla (fecha + minutos Bogotá), sin offset a mano.
 */
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE_BOGOTA, diaBogota } from "@/lib/fechas/formato-bogota";

export const H0 = 7; // primera hora visible
export const H1 = 21; // última hora visible
export const PXH = 44; // alto de una hora en px
export const SNAP = 30; // minutos
export const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export type Modalidad = "VIRTUAL" | "PRESENCIAL";
export type Repeticion = "no" | "semanal" | "labor";

function civil(fecha: string): Date {
    return new Date(`${fecha}T12:00:00Z`);
}
function fechaStr(d: Date): string {
    return d.toISOString().slice(0, 10);
}
export function addDias(fecha: string, n: number): string {
    const d = civil(fecha);
    d.setUTCDate(d.getUTCDate() + n);
    return fechaStr(d);
}
/** 0 = lunes … 6 = domingo. */
export function diaSemana(fecha: string): number {
    return (civil(fecha).getUTCDay() + 6) % 7;
}
export function lunesDe(fecha: string): string {
    return addDias(fecha, -diaSemana(fecha));
}
export function numMes(fecha: string): number {
    return civil(fecha).getUTCDate();
}
export function nombreMes(fecha: string): string {
    return MESES[civil(fecha).getUTCMonth()];
}
export function fmt(min: number): string {
    const h = Math.floor(min / 60);
    const mm = min % 60;
    const ap = h < 12 ? "a.m." : "p.m.";
    let hh = h % 12;
    if (hh === 0) hh = 12;
    return `${hh}:${String(mm).padStart(2, "0")} ${ap}`;
}
export function snap(min: number): number {
    return Math.round(min / SNAP) * SNAP;
}

/**
 * Posición vertical (px) de un bloque en la rejilla a partir de sus minutos Bogotá.
 * Fuente única de la geometría del bloque (la usan el profesional y el padre) para que
 * las cuadrículas no se dupliquen ni se desincronicen (SPEC-730).
 */
export function estiloBloque(minInicio: number, minFin: number): { top: number; height: number } {
    return { top: (minInicio / 60 - H0) * PXH, height: ((minFin - minInicio) / 60) * PXH };
}

/**
 * Proyecta un instante (ISO UTC) a su lugar en la rejilla en hora de Bogotá: la fecha
 * civil (`yyyy-MM-dd`) y los minutos desde medianoche. Cliente-seguro (date-fns-tz),
 * misma zona que el resto del sistema (`formato-bogota`): sin offset a mano (D-69).
 * Lo usa el lado del padre para mapear franjas/citas que llegan como ISO a la rejilla;
 * el profesional ya recibe la proyección hecha por su servicio.
 */
export function posicionBogota(iso: string): { fecha: string; minutos: number } {
    const d = new Date(iso);
    const [h, m] = formatInTimeZone(d, TIMEZONE_BOGOTA, "HH:mm").split(":").map(Number);
    return { fecha: diaBogota(d), minutos: h * 60 + m };
}
