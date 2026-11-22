/**
 * Concentración del portafolio en acciones: la primera especie, las tres primeras y el índice de Herfindahl-Hirschman
 * (Σ peso²). Los pesos salen en Decimal del valor del tablero y se redondean al final. Puro.
 */
import type { Prisma } from "@prisma/client";
import type { Concentracion } from "./tipos";

export interface ValorEspecie {
  readonly instrumentoId: string;
  readonly valor: Prisma.Decimal | null;
}

/** Solo cuentan las especies con valor positivo; null si no hay ninguna. En un empate de valor, por id. */
export function concentracionDe(especies: readonly ValorEspecie[]): Concentracion | null {
  throw new Error("sin implementar");
}
