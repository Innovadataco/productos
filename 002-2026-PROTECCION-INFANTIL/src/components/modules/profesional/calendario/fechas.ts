/**
 * SPEC-714 · Constantes y helpers puros del calendario (compartidos por la rejilla,
 * los paneles y el componente principal). Fechas CIVILES de Bogotá sin zona horaria:
 * mediodía UTC nunca cruza el día. La conversión hora-de-pared → instante vive aparte,
 * en el componente, por `instanteDesdeHoraBogota` (I-247 · D-69).
 */
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
