/**
 * SPEC-143 — Fechas en lenguaje humano, SIN librerías (decisión del spec: helper
 * local, cero dependencias nuevas de fecha).
 * - `fechaLargaES`: "lunes 3 de agosto de 2026" (saludo de la home).
 * - `relativoHumano`: "hace 12 minutos" / "hace 3 horas" / "hace 2 días" (franja
 *   de vigilancia); más allá de 59 días cae a fecha corta "3 ago 2026".
 * - `etiquetaPeriodo`: etiqueta corta para los ejes/tooltips de la tendencia
 *   (semanal → "27 jul", mensual → "sep 2026", anual → "2026").
 */

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

const MESES_CORTOS = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
] as const;

export function fechaLargaES(fecha: Date): string {
    return `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

function plural(cantidad: number, singular: string, pluralForma: string): string {
    return `${cantidad} ${cantidad === 1 ? singular : pluralForma}`;
}

export function relativoHumano(fecha: Date, ahora: Date = new Date()): string {
    const ms = ahora.getTime() - fecha.getTime();
    if (ms < 0) return "justo ahora";
    const minutos = Math.floor(ms / 60_000);
    if (minutos < 1) return "hace un momento";
    if (minutos < 60) return `hace ${plural(minutos, "minuto", "minutos")}`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${plural(horas, "hora", "horas")}`;
    const dias = Math.floor(horas / 24);
    if (dias < 60) return `hace ${plural(dias, "día", "días")}`;
    return `el ${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

export type GranularidadTendencia = "semanal" | "mensual" | "anual";

/**
 * Etiqueta corta de un punto de la tendencia. `periodo` es la fecha ISO de inicio
 * del periodo (lunes de la semana / día 1 del mes / 1 de enero del año).
 */
export function etiquetaPeriodo(periodo: string, granularidad: GranularidadTendencia): string {
    const fecha = new Date(periodo);
    if (Number.isNaN(fecha.getTime())) return periodo;
    if (granularidad === "anual") return String(fecha.getUTCFullYear());
    if (granularidad === "mensual") return `${MESES_CORTOS[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`;
    return `${fecha.getUTCDate()} ${MESES_CORTOS[fecha.getUTCMonth()]}`;
}
