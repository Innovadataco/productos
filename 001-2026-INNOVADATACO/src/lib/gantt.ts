/**
 * Matemática del Gantt (spec 015, RZ-2 / SC-003).
 *
 * Todo el cálculo de posición y escala vive aquí, en funciones **puras** y sin
 * dominio: habla de `ItemGantt` (barra o rombo con inicio/fin), no de
 * entregables ni hitos. El componente traduce el dominio a `ItemGantt` y pinta
 * con estos números; SPEC-016 monta el arrastre encima **sin tocar** esta
 * matemática.
 *
 * Las posiciones se devuelven como **fracciones 0..1** del ancho del rango: el
 * componente las multiplica por su ancho en píxeles. Así el cálculo no depende
 * del DOM y se prueba sin lienzo.
 */

export type EscalaGantt = "dia" | "semana" | "mes";

export interface ItemGantt {
  id: string;
  tipo: "barra" | "hito";
  inicio: Date;
  /** Fin de la barra; `null` en un hito puntual. */
  fin: Date | null;
  /** Avance 0-100, solo en barras. */
  avance?: number;
  label: string;
  /** Id de la tarea de la que depende (fin→inicio), opcional (spec 016). */
  dependeDe?: string | null;
}

export interface RangoGantt {
  desde: Date;
  hasta: Date;
}

const MS_DIA = 24 * 60 * 60 * 1000;

/** Ancho mínimo del rango: un cronograma de un solo día no puede tener ancho cero. */
const DIAS_MINIMOS = 7;

function soloFecha(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sumarDias(d: Date, dias: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
}

/**
 * Rango a dibujar: del inicio más temprano al fin más tardío, con un margen de
 * un día a cada lado para que nada quede pegado al borde. `null` si no hay
 * ningún item con fecha.
 */
export function rangoDeItems(items: ItemGantt[], hoy: Date): RangoGantt | null {
  const fechas: number[] = [];
  for (const item of items) {
    fechas.push(soloFecha(item.inicio).getTime());
    if (item.fin) fechas.push(soloFecha(item.fin).getTime());
  }
  if (fechas.length === 0) return null;

  let desde = new Date(Math.min(...fechas));
  let hasta = new Date(Math.max(...fechas));

  // "Hoy" entra en el rango para que su línea siempre tenga dónde caer.
  const hoySolo = soloFecha(hoy);
  if (hoySolo < desde) desde = hoySolo;
  if (hoySolo > hasta) hasta = hoySolo;

  // Margen de un día a cada lado.
  desde = sumarDias(desde, -1);
  hasta = sumarDias(hasta, 1);

  // Ancho mínimo: si el rango es más corto que DIAS_MINIMOS, se ensancha.
  const dias = Math.round((hasta.getTime() - desde.getTime()) / MS_DIA);
  if (dias < DIAS_MINIMOS) hasta = sumarDias(desde, DIAS_MINIMOS);

  return { desde, hasta };
}

/** Fracción 0..1 de una fecha dentro del rango (fuera de rango se acota a 0/1). */
export function fraccion(fecha: Date, rango: RangoGantt): number {
  const total = rango.hasta.getTime() - rango.desde.getTime();
  if (total <= 0) return 0;
  const bruta = (fecha.getTime() - rango.desde.getTime()) / total;
  return Math.min(1, Math.max(0, bruta));
}

/** Posición de un item como fracciones: `left` y `width` (0 en un rombo puntual). */
export function posicionItem(item: ItemGantt, rango: RangoGantt): { left: number; width: number } {
  const left = fraccion(item.inicio, rango);
  if (!item.fin) return { left, width: 0 };
  const right = fraccion(item.fin, rango);
  return { left, width: Math.max(0, right - left) };
}

/** Ancho de relleno del avance dentro de una barra, como fracción de la barra (0..1). */
export function fraccionAvance(item: ItemGantt): number {
  if (item.tipo !== "barra" || item.avance === undefined) return 0;
  return Math.min(1, Math.max(0, item.avance / 100));
}

/** Posición de la línea de HOY, o `null` si cae fuera del rango dibujado (FR-003). */
export function posicionHoy(rango: RangoGantt, hoy: Date): number | null {
  const h = soloFecha(hoy);
  if (h < rango.desde || h > rango.hasta) return null;
  return fraccion(h, rango);
}

export interface TickGantt {
  fecha: Date;
  fraccion: number;
  etiqueta: string;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Lunes de la semana que contiene `d` (semana ISO: lunes = inicio). */
function lunesDe(d: Date): Date {
  const dia = (d.getDay() + 6) % 7; // 0 = lunes
  return sumarDias(soloFecha(d), -dia);
}

/**
 * Marcas de la cabecera según la escala (FR-002).
 * - día: una por día; - semana: una por lunes; - mes: una por día 1.
 */
export function ticks(rango: RangoGantt, escala: EscalaGantt): TickGantt[] {
  const salida: TickGantt[] = [];

  if (escala === "dia") {
    let cursor = soloFecha(rango.desde);
    while (cursor <= rango.hasta) {
      salida.push({
        fecha: cursor,
        fraccion: fraccion(cursor, rango),
        etiqueta: String(cursor.getDate()),
      });
      cursor = sumarDias(cursor, 1);
    }
  } else if (escala === "semana") {
    let cursor = lunesDe(rango.desde);
    while (cursor <= rango.hasta) {
      salida.push({
        fecha: cursor,
        fraccion: fraccion(cursor, rango),
        etiqueta: `${cursor.getDate()} ${MESES[cursor.getMonth()]}`,
      });
      cursor = sumarDias(cursor, 7);
    }
  } else {
    let cursor = new Date(rango.desde.getFullYear(), rango.desde.getMonth(), 1);
    while (cursor <= rango.hasta) {
      salida.push({
        fecha: cursor,
        fraccion: fraccion(cursor, rango),
        etiqueta: `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  return salida;
}
