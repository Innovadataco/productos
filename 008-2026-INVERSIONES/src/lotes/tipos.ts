/** Tipos del módulo de lotes, sin base de datos (los usan el FIFO, la regla de coherencia y posiciones). */
import type { Prisma } from "@prisma/client";

export interface LoteFifo {
  readonly id: string;
  readonly fechaCompra: Date;
  readonly cantidad: bigint;
  readonly costoTotal: Prisma.Decimal;
}

export interface VentaFifo {
  readonly id: string;
  readonly fecha: Date;
  readonly cantidad: bigint;
}

export interface Asignacion {
  readonly ventaId: string;
  readonly loteId: string;
  readonly cantidad: bigint;
  readonly costoBase: Prisma.Decimal;
}

/** Una bloqueada (o un conjunto de asignaciones guardadas) que no cuadra con sus lotes y ventas. */
export type CodigoBloqueada =
  | "BLOQUEADA_VENTA_AJENA"
  | "BLOQUEADA_LOTE_AJENO"
  | "BLOQUEADA_LOTE_POSTERIOR"
  | "BLOQUEADA_EXCEDE_VENTA"
  | "BLOQUEADA_EXCEDE_LOTE"
  | "BLOQUEADA_EXCEDE_COSTO"
  | "BLOQUEADA_COSTO_DESCUADRADO";

/** Rechazos que salen al correr el FIFO con bloqueadas válidas. */
export type CodigoFifo = "BLOQUEADA_INCOMPLETA" | "COSTO_NEGATIVO";

export type CodigoRechazo = CodigoBloqueada | CodigoFifo;

export interface Rechazo {
  readonly codigo: CodigoRechazo;
  readonly ventaId: string | null;
  readonly loteId: string | null;
}
