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

export const H0 = 7; // banda creable — primera hora (guard de creación del profesional)
export const H1 = 21; // banda creable — última hora
export const PXH = 44; // alto de una hora en px — ESCALA CONSTANTE (no cambia con la ventana)
export const SNAP = 30; // minutos

// SPEC-771 · ventana ADAPTATIVA del riel. La escala (PXH) es constante; lo que cambia es el
// RANGO vertical, derivado del contenido del período (nunca esconde una cita/franja).
const MARGEN_MIN = 30; // aire arriba/abajo del contenido
const FRONTERA_MIN = 30; // el borde del riel cae en hora o media hora
const SPAN_MINIMO_MIN = 5 * 60; // riel mínimo legible: una cita corta no deja un sliver
/** Default legible para el PADRE cuando el período no tiene contenido (FORMA §2). */
export const DEFAULT_VACIO_PADRE: readonly [number, number] = [8 * 60, 18 * 60]; // 8am–6pm
/** Banda creable del PROFESIONAL: el riel SIEMPRE la incluye (D-2: la UI no esconde horas creables). */
export const BANDA_CREABLE: readonly [number, number] = [H0 * 60, H1 * 60]; // 7am–9pm

export interface OpcionesVentana {
    /** Banda que el riel SIEMPRE incluye (profesional = banda creable). Ausente en el padre. */
    bandaMinimaMin?: readonly [number, number];
    /** Rango por defecto si el período no tiene contenido (y sin banda que lo cubra). */
    defaultVacioMin: readonly [number, number];
}

const piso = (min: number) => Math.floor(min / FRONTERA_MIN) * FRONTERA_MIN;
const techo = (min: number) => Math.ceil(min / FRONTERA_MIN) * FRONTERA_MIN;

/**
 * SPEC-771 · Ventana ADAPTATIVA (pura, fuente única): el rango vertical `[inicioMin, finMin]`
 * del riel para el período visible. Deriva del CONTENIDO ± margen; NUNCA recorta contenido.
 *  - Sin contenido → `bandaMinimaMin` (si hay) o `defaultVacioMin`.
 *  - Con contenido → [piso(min)−margen, techo(max)+margen], en UNIÓN con `bandaMinimaMin`
 *    (el profesional nunca esconde horas creables) — se EXPANDE si el contenido cae fuera.
 *  - Span mínimo legible: expande centrado (jamás recorta).
 */
export function ventanaAdaptativa(
    bloques: ReadonlyArray<{ minInicio: number; minFin: number }>,
    opciones: OpcionesVentana,
): { inicioMin: number; finMin: number } {
    const { bandaMinimaMin, defaultVacioMin } = opciones;
    let inicio: number;
    let fin: number;
    if (bloques.length === 0) {
        [inicio, fin] = bandaMinimaMin ?? defaultVacioMin;
    } else {
        inicio = piso(Math.min(...bloques.map((b) => b.minInicio))) - MARGEN_MIN;
        fin = techo(Math.max(...bloques.map((b) => b.minFin))) + MARGEN_MIN;
        if (bandaMinimaMin) {
            inicio = Math.min(inicio, bandaMinimaMin[0]);
            fin = Math.max(fin, bandaMinimaMin[1]);
        }
    }
    // Span mínimo: expande centrado (nunca recorta lo que ya entra).
    if (fin - inicio < SPAN_MINIMO_MIN) {
        const centro = (inicio + fin) / 2;
        inicio = centro - SPAN_MINIMO_MIN / 2;
        fin = centro + SPAN_MINIMO_MIN / 2;
    }
    // Encaje en [0, 24h] desplazando en bloque (preserva el span; nunca recorta contenido).
    if (inicio < 0) { fin += -inicio; inicio = 0; }
    if (fin > 24 * 60) { inicio = Math.max(0, inicio - (fin - 24 * 60)); fin = 24 * 60; }
    // Bordes en HORA entera (solo expande) → filas y etiquetas del riel limpias.
    return { inicioMin: Math.floor(inicio / 60) * 60, finMin: Math.min(24 * 60, Math.ceil(fin / 60) * 60) };
}
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
export function estiloBloque(minInicio: number, minFin: number, railInicioMin: number): { top: number; height: number } {
    return { top: ((minInicio - railInicioMin) / 60) * PXH, height: ((minFin - minInicio) / 60) * PXH };
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
