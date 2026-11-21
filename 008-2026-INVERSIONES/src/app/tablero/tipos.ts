/** Datos del tablero ya serializados (texto decimal), listos para cruzar del servidor al cliente. */
import type { MotivoSinComparar } from "@/tablero/movimiento";

export interface MovimientoEspecieVista {
  readonly id: string;
  readonly nemo: string;
  readonly aporte: string;
  readonly variacionPct: string;
}

/** «Qué movió», ya calculado en el servidor (src/tablero/movimiento.ts): el cliente solo da formato. */
export interface MovimientoVista {
  readonly referencia: string | null;
  readonly previa: string | null;
  readonly especies: readonly MovimientoEspecieVista[];
  readonly neto: string | null;
  readonly omitidas: number;
  readonly motivo: MotivoSinComparar | null;
}

export interface FilaVista {
  readonly id: string;
  readonly nemo: string;
  readonly cantidad: string;
  readonly costo: string;
  readonly valor: string | null;
  readonly sinVender: string | null;
  readonly rentabilidadPct: string | null;
  readonly pesoPct: string | null;
  readonly realizada: string;
  readonly dividendos: string;
  readonly comisiones: string;
  /** `atrasado`: el cierre es anterior a la fecha de referencia del tablero (se pinta «precio del <fecha>»). */
  readonly cierre: { readonly precio: string; readonly fecha: string; readonly verificado: boolean; readonly atrasado: boolean } | null;
  readonly lotesVivos: number;
  readonly serie: readonly { readonly fecha: string; readonly precio: string }[];
}

export interface Vista {
  readonly filas: FilaVista[];
  readonly cerradas: FilaVista[];
  readonly valorAcciones: string;
  readonly sinVender: string;
  readonly porVentas: string;
  readonly dividendos: string;
  readonly comisiones: string;
  readonly gananciaTotal: string;
  readonly especiesSinPrecio: number;
  /** Cierre más reciente entre las especies vivas. */
  readonly fechaReferencia: string | null;
  /** Cierre más viejo entre las especies vivas; si difiere de la referencia, hay precios de fechas distintas. */
  readonly cierreMasViejo: string | null;
  readonly especiesAtrasadas: number;
  readonly movimiento: MovimientoVista;
  readonly ultimaCarga: string | null;
  /** Nemotécnicos con ventas que sus lotes no cubren: no entran en filas, cerradas ni totales. */
  readonly incompletas: readonly string[];
}

/**
 * La última conciliación con la certificación de A&V, tal como quedó guardada (sin recalcular): la línea que
 * enlaza a /conciliacion. null: todavía no hay certificación cargada.
 */
export type LineaConciliacionVista = { readonly fechaCorte: string; readonly resultado: "CUADRA" | "NO_CUADRA" | "PARCIAL" | null } | null;
