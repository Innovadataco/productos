/**
 * Validación en el borde del motor: lo que llega de los lectores se revisa antes de calcular. Cualquier violación del
 * contrato es un RangeError con el campo; el motor no corrige ni completa datos. Puro.
 */
import type { EntradasAnalisis, PlanParaAnalisis } from "./tipos";

export function validarEntradas(e: EntradasAnalisis): void {
  throw new Error("sin implementar");
}

export function validarPlan(plan: PlanParaAnalisis): void {
  throw new Error("sin implementar");
}
