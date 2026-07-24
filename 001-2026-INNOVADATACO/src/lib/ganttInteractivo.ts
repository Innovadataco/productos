/**
 * Matemática INVERSA del Gantt para el arrastre (spec 016, RZ-2 / FR-006).
 *
 * SPEC-015 dejó la ida (fecha → fracción) en `gantt.ts` y no se toca. Aquí va la
 * vuelta (fracción → fecha) con snap a la escala, el cálculo de nuevas fechas al
 * mover/redimensionar, y la detección de conflictos de dependencia. Todo puro y
 * testeable: el componente solo aporta el estado de interacción del ratón.
 */
import type { EscalaGantt, ItemGantt, RangoGantt } from "./gantt";

const MS_DIA = 24 * 60 * 60 * 1000;

function soloFecha(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function sumarDias(d: Date, dias: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
}

/** Fecha cruda en una fracción 0..1 del rango (la inversa de `fraccion`). */
export function fechaEnFraccion(frac: number, rango: RangoGantt): Date {
  const acotada = Math.min(1, Math.max(0, frac));
  const ms = rango.desde.getTime() + acotada * (rango.hasta.getTime() - rango.desde.getTime());
  return new Date(ms);
}

/** Ajusta una fecha a la unidad de la escala activa (FR-004). */
export function snap(fecha: Date, escala: EscalaGantt): Date {
  if (escala === "mes") return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  if (escala === "semana") {
    const dia = (fecha.getDay() + 6) % 7; // 0 = lunes
    return sumarDias(soloFecha(fecha), -dia);
  }
  return soloFecha(fecha); // día
}

/** Fecha nueva a partir de una posición soltada, ya ajustada a la escala. */
export function nuevaFechaSnap(frac: number, rango: RangoGantt, escala: EscalaGantt): Date {
  return snap(fechaEnFraccion(frac, rango), escala);
}

/** Diferencia en días enteros entre dos fechas (b - a). */
function diffDias(a: Date, b: Date): number {
  return Math.round((soloFecha(b).getTime() - soloFecha(a).getTime()) / MS_DIA);
}

/**
 * Mover el CUERPO de una barra: inicio y fin se desplazan juntos, así que la
 * **duración no cambia** (FR-001). `nuevoInicioFrac` es dónde se soltó el inicio.
 */
export function moverBarra(
  item: ItemGantt,
  nuevoInicioFrac: number,
  rango: RangoGantt,
  escala: EscalaGantt,
): { inicio: Date; fin: Date | null } {
  const nuevoInicio = nuevaFechaSnap(nuevoInicioFrac, rango, escala);
  if (!item.fin) return { inicio: nuevoInicio, fin: null };
  const dias = diffDias(item.inicio, item.fin);
  return { inicio: nuevoInicio, fin: sumarDias(nuevoInicio, dias) };
}

/**
 * Redimensionar por un borde: cambia SOLO inicio o SOLO fin (FR-001).
 *
 * Se impide que el fin quede antes del inicio (o viceversa): una barra no puede
 * terminar antes de empezar. En ese caso el borde arrastrado se pega al otro.
 */
export function redimensionar(
  item: ItemGantt,
  borde: "inicio" | "fin",
  frac: number,
  rango: RangoGantt,
  escala: EscalaGantt,
): { inicio: Date; fin: Date | null } {
  const fecha = nuevaFechaSnap(frac, rango, escala);
  if (borde === "inicio") {
    const fin = item.fin ?? item.inicio;
    return { inicio: fecha > fin ? fin : fecha, fin: item.fin };
  }
  const finPropuesto = fecha < item.inicio ? item.inicio : fecha;
  return { inicio: item.inicio, fin: finPropuesto };
}

/**
 * Ids de los items en conflicto con la tarea de la que dependen (FR-003).
 *
 * Conflicto = la precedente **termina después** de que empieza la dependiente
 * (fin→inicio incumplido). Una referencia colgada (la precedente ya no existe)
 * no genera conflicto. No reprograma nada: solo devuelve el conjunto a marcar.
 */
export function detectarConflictos(items: ItemGantt[]): Set<string> {
  const porId = new Map(items.map((i) => [i.id, i]));
  const enConflicto = new Set<string>();

  for (const item of items) {
    if (!item.dependeDe) continue;
    const precede = porId.get(item.dependeDe);
    if (!precede) continue; // referencia colgada = sin dependencia
    const finPrecede = precede.fin ?? precede.inicio;
    // fin→inicio: la precedente debe terminar antes (o al empezar) la dependiente.
    if (finPrecede > item.inicio) enConflicto.add(item.id);
  }

  return enConflicto;
}
