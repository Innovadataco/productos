/**
 * Las reglas del plan que la orden toca. Información, nunca un juicio sobre la operación:
 * - MONTO_ORDEN_BAJO (de portafolio o de la especie): el valor de la orden queda por debajo del monto mínimo que el
 *   dueño fijó (igual no cuenta);
 * - CIERRE_BAJO o CIERRE_SOBRE de la especie: el precio límite queda del lado que toca el nivel, o en el nivel
 *   (`estadoDelNivel`, la misma regla de la pantalla del plan, con el precio de la orden en lugar del cierre);
 * - otra acción: una regla de la especie (no de portafolio ni de monto) cuya acción no es la de la orden, se cumpla o
 *   no su condición; el texto la cita con su condición, tal como está en el plan.
 * Solo rigen las reglas sin plazo o con el plazo hoy o después. Puro.
 */
import type { Prisma } from "@prisma/client";
import { estadoDelNivel, type EstadoNivel } from "@/plan/niveles";
import type { Afectacion, FrenteAlNivel, OperacionSimulada, ReglaAfectada, ReglaSimulada } from "./tipos";
import { noVacia } from "./validar";

/** Sin plazo, o con el plazo hoy o después (los dos a medianoche UTC). */
export const rigeHoy = (regla: ReglaSimulada, hoy: Date): boolean => regla.plazoHasta === null || regla.plazoHasta.getTime() >= hoy.getTime();

const esFrente = (e: EstadoNivel): e is FrenteAlNivel => e.estado === "TOCADA" || e.estado === "EN_EL_NIVEL";

function porElMonto(r: ReglaSimulada, valorOrden: Prisma.Decimal): Afectacion[] {
  return r.nivel !== null && valorOrden.lt(r.nivel) ? [{ tipo: "MONTO_ORDEN_BAJO" }] : [];
}

function porLaEspecie(r: ReglaSimulada, op: OperacionSimulada): Afectacion[] {
  const frente = estadoDelNivel(r.condicion, r.nivel, op.precioLimite);
  return [
    ...(esFrente(frente) ? [{ tipo: "PRECIO_DEL_LADO_DEL_NIVEL", frente } as const] : []),
    ...(r.accion !== op.lado ? [{ tipo: "OTRA_ACCION" } as const] : []),
  ];
}

function afectacionesDe(r: ReglaSimulada, op: OperacionSimulada, valorOrden: Prisma.Decimal): Afectacion[] {
  const deLaEspecie = r.instrumentoId === op.instrumentoId;
  if (!deLaEspecie && r.instrumentoId !== null) return [];
  if (r.condicion === "MONTO_ORDEN_BAJO") return porElMonto(r, valorOrden);
  return deLaEspecie ? porLaEspecie(r, op) : [];
}

/** Las reglas que rigen hoy y que la orden toca, en el orden del plan, cada una con lo que la toca. */
export function reglasAfectadas(reglas: readonly ReglaSimulada[], op: OperacionSimulada, valorOrden: Prisma.Decimal, hoy: Date): ReglaAfectada[] {
  return reglas
    .filter((r) => rigeHoy(r, hoy))
    .flatMap((regla): ReglaAfectada[] => {
      const afectaciones = noVacia(afectacionesDe(regla, op, valorOrden));
      return afectaciones === null ? [] : [{ regla, afectaciones }];
    });
}
