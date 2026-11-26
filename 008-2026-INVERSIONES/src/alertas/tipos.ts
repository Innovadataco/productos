/**
 * Tipos del motor de alertas. Puro: todo entra por parámetro. `PrecioUltimo` es compatible con `PrecioIntradiaLeido`
 * (lector intradía) sin importarlo. Informa; no recomienda comprar ni vender.
 */
import type { Prisma } from "@prisma/client";

export const TIPOS_ALERTA = ["NIVEL_CRUZADO", "NIVEL_CERCA", "MOVIMIENTO_DIA", "CAIDA_PORTAFOLIO", "DATO_VIEJO", "FECHA_EX"] as const;
export type TipoAlerta = (typeof TIPOS_ALERTA)[number];
export type Sentido = "BAJO" | "SOBRE";
/** DATO_VIEJO se distingue por el sentido: RUEDA (la barra intradía está vieja) o CIERRE_FALTANTE (falta el cierre del día). */
export type SentidoAlerta = Sentido | "RUEDA" | "CIERRE_FALTANTE";
/** De dónde sale el precio: la última barra del día o el cierre del día. */
export type BasePrecio = "INTRADIA" | "CIERRE";

/** La barra intradía más reciente de una especie. */
export interface PrecioUltimo {
  readonly instante: Date;
  readonly precio: Prisma.Decimal;
  /** Yahoo la marcó con retraso. */
  readonly conRetraso: boolean;
}

/** Un precio ya elegido para evaluar. El instante y el retraso solo existen en el intradía. */
export interface PrecioEvaluado {
  readonly base: BasePrecio;
  readonly precio: Prisma.Decimal;
  readonly instante?: Date;
  readonly conRetraso?: boolean;
}

export interface DatosAlerta {
  readonly nivel?: Prisma.Decimal;
  readonly precio?: Prisma.Decimal;
  /** Variación porcentual con signo, ya calculada exacta y recortada a 2 decimales. */
  readonly variacionPct?: Prisma.Decimal;
  readonly distanciaPct?: Prisma.Decimal;
  readonly instante?: Date;
  readonly conRetraso?: boolean;
  readonly esFechaEx?: boolean;
  readonly fechaEx?: Date;
  readonly fechaPago?: Date;
  readonly minutosDeEdad?: number;
  readonly umbralMin?: number;
}

export interface Alerta {
  /** Clave única: día, tipo, especie, regla y sentido (la base no entra: un cruce en el intradía y en el cierre cuenta una vez). */
  readonly clave: string;
  /** AAAA-MM-DD, día de Colombia. */
  readonly dia: string;
  readonly tipo: TipoAlerta;
  readonly instrumentoId: string | null;
  readonly reglaId: string | null;
  readonly sentido: SentidoAlerta | null;
  readonly base: BasePrecio | null;
  readonly datos: DatosAlerta;
}

export function claveDeAlerta(dia: string, tipo: TipoAlerta, instrumentoId: string | null, reglaId: string | null, sentido: SentidoAlerta | null): string {
  return [dia, tipo, instrumentoId ?? "-", reglaId ?? "-", sentido ?? "-"].join("|");
}
