/**
 * Los puntos de las reglas de nivel del plan, medidos con el PRECIO LÍMITE de la orden (el precio de mercado es el mismo
 * antes y después, así que no distingue nada). Usa `estadoDelNivel`, la misma regla de /plan. LIBRE, MONTO_ORDEN_BAJO y
 * NINGUNA no tienen precio que medir. Solo rigen las reglas sin plazo o con el plazo hoy o después. Puro.
 */
import type { Prisma } from "@prisma/client";
import { estadoDelNivel } from "@/plan/niveles";
import { redondear } from "../numeros";
import { importanciaDe, rangoDe } from "./rangos";
import type { Punto, Sujeto } from "./tipos";

/** Lo que se lee de una regla (cabe en ReglaSimulada y en ReglaParaAnalisis). */
export interface ReglaDeNivel {
  readonly id: string;
  readonly instrumentoId: string | null;
  readonly condicion: "CIERRE_BAJO" | "CIERRE_SOBRE" | "MONTO_ORDEN_BAJO" | "LIBRE" | "NINGUNA";
  readonly nivel: Prisma.Decimal | null;
  readonly plazoHasta: Date | null;
}

/** La misma regla de `rigeHoy` (src/operar/simulador/reglas.ts): sin plazo o con el plazo hoy o después. */
export const rigeEnNivel = (r: Pick<ReglaDeNivel, "plazoHasta">, hoy: Date): boolean => r.plazoHasta === null || r.plazoHasta.getTime() >= hoy.getTime();

function deLaRegla(r: ReglaDeNivel, precio: Prisma.Decimal): Punto[] {
  const sujeto: Sujeto = { tipo: "ORDEN", reglaId: r.id, instrumentoId: r.instrumentoId! };
  const e = estadoDelNivel(r.condicion, r.nivel, precio);
  if (e.estado === "TOCADA") return [{ clave: "REGLA_TOCADA", sujeto, rango: "TOCADA", importancia: importanciaDe("REGLA_TOCADA", "TOCADA"), medido: 0 }];
  if (e.estado === "EN_EL_NIVEL") return [{ clave: "REGLA_EN_EL_NIVEL", sujeto, rango: "EN_EL_NIVEL", importancia: importanciaDe("REGLA_EN_EL_NIVEL", "EN_EL_NIVEL"), medido: 0 }];
  if (e.estado !== "A_DISTANCIA") return [];
  const distancia = redondear(Math.abs(e.distanciaPct.toNumber()));
  const tramo = rangoDe("REGLA_DISTANCIA", distancia);
  return tramo === null ? [] : [{ clave: "REGLA_DISTANCIA", sujeto, rango: tramo.rango, importancia: tramo.importancia, medido: distancia }];
}

export function puntosDeNivel(reglas: readonly ReglaDeNivel[], instrumentoId: string, precioLimite: Prisma.Decimal, hoy: Date): readonly Punto[] {
  return reglas.filter((r) => r.instrumentoId === instrumentoId && rigeEnNivel(r, hoy)).flatMap((r) => deLaRegla(r, precioLimite));
}
