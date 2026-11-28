/**
 * Qué tan cerca está una regla de su nivel (fase B, corte 3). Puro. Informa («su regla se tocó»); no recomienda.
 * - CIERRE_BAJO se toca si el cierre queda estrictamente por debajo del nivel; CIERRE_SOBRE, por encima.
 * - Si no se tocó: distancia = (nivel − cierre) / cierre × 100, lo que tendría que moverse el cierre para llegar.
 * - Solo con el cierre al día (quien llama pasa null si está atrasado): un cierre viejo daría una distancia falsa.
 * - NINGUNA, LIBRE y MONTO_ORDEN_BAJO (pesos por orden, no un precio) no tienen distancia.
 */
import { Prisma, type CondicionRegla } from "@prisma/client";

const DECIMALES_DISTANCIA = 2;
const CIEN = new Prisma.Decimal(100);

export type EstadoNivel =
  | { readonly estado: "SIN_NIVEL" }
  | { readonly estado: "SIN_CIERRE_AL_DIA" }
  | { readonly estado: "TOCADA"; readonly lado: "BAJO" | "SOBRE" }
  | { readonly estado: "EN_EL_NIVEL" }
  | { readonly estado: "A_DISTANCIA"; readonly distanciaPct: Prisma.Decimal };

export function estadoDelNivel(condicion: CondicionRegla, nivel: Prisma.Decimal | null, cierreAlDia: Prisma.Decimal | null): EstadoNivel {
  if ((condicion !== "CIERRE_BAJO" && condicion !== "CIERRE_SOBRE") || nivel === null) return { estado: "SIN_NIVEL" };
  if (cierreAlDia === null || !cierreAlDia.gt(0)) return { estado: "SIN_CIERRE_AL_DIA" };
  if (cierreAlDia.eq(nivel)) return { estado: "EN_EL_NIVEL" };
  if (condicion === "CIERRE_BAJO" && cierreAlDia.lt(nivel)) return { estado: "TOCADA", lado: "BAJO" };
  if (condicion === "CIERRE_SOBRE" && cierreAlDia.gt(nivel)) return { estado: "TOCADA", lado: "SOBRE" };
  const distanciaPct = nivel.sub(cierreAlDia).div(cierreAlDia).mul(CIEN).toDecimalPlaces(DECIMALES_DISTANCIA, Prisma.Decimal.ROUND_HALF_UP);
  return { estado: "A_DISTANCIA", distanciaPct };
}
