/** Una fila del CSV de decretos del dueño (fase C, C4a). PENDIENTE (rojo de C4a). */
import type { Hallazgo } from "../registro/hallazgos";

export const COLUMNAS = [
  "especie", "tipo", "fecha_anuncio", "cuota", "valor_por_accion", "moneda", "forma", "fecha_ex", "fecha_pago", "referencia", "anulada", "nota",
] as const;
export type Columna = (typeof COLUMNAS)[number];

export type TipoDecreto = "ORDINARIO" | "EXTRAORDINARIO";

export const ESCALA_VALOR = 6;
export const CUOTA_MIN = 1;
export const CUOTA_MAX = 12;
export const MAX_NOTA = 500;
export const MAX_REFERENCIA = 500;
export const REFERENCIAS_OFICIALES: readonly string[] = [];

export interface DecretoLeido {
  readonly linea: number;
  readonly especie: string;
  readonly tipo: TipoDecreto;
  readonly fechaAnuncio: Date;
  readonly cuota: number;
  readonly valorPorAccion: string;
  readonly fechaEx: Date;
  readonly fechaPago: Date;
  readonly referencia: string;
  readonly anulada: boolean;
  readonly nota: string | null;
}

export type LecturaFila = { readonly ok: true; readonly decreto: DecretoLeido } | { readonly ok: false; readonly hallazgos: readonly Hallazgo[] };

export function interpretarFila(_celdas: readonly string[], _linea: number, _hoy: Date): LecturaFila {
  throw new Error("PENDIENTE");
}
