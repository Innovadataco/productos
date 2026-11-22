/**
 * Validación en el borde del motor: lo que llega de los lectores se revisa antes de calcular. Cualquier violación del
 * contrato es un RangeError con el campo; el motor no corrige ni completa datos. Puro.
 */
import { esFechaDeNegocio } from "../plan/fechas";
import { diaIso } from "../precios/horario";
import type { EntradasAnalisis, PlanParaAnalisis } from "./tipos";

function sinRepetidos(ids: readonly string[], que: string): void {
  const vistos = new Set<string>();
  for (const id of ids) {
    if (vistos.has(id)) throw new RangeError(`${que}: el id ${id} viene repetido.`);
    vistos.add(id);
  }
}

export function validarEntradas(e: EntradasAnalisis): void {
  if (!esFechaDeNegocio(e.hoy)) throw new RangeError("hoy debe ser una fecha de negocio (medianoche UTC).");
  if (e.historia.hoy.getTime() !== e.hoy.getTime()) throw new RangeError("La historia debe leerse con el mismo hoy del análisis.");
  const filas = [...e.tablero.filas, ...e.tablero.cerradas];
  sinRepetidos(filas.map((f) => f.instrumentoId), "tablero");
  sinRepetidos(e.historia.posiciones.map((p) => p.instrumentoId), "historia");
  const futura = filas.find((f) => f.cierre !== null && f.cierre.fecha > e.hoy);
  if (futura) throw new RangeError(`El cierre de ${futura.instrumentoId} (${diaIso(futura.cierre!.fecha)}) es posterior a hoy.`);
  const sinPrecio = filas.find((f) => f.cierre !== null && !f.cierre.precio.gt(0));
  if (sinPrecio) throw new RangeError(`El cierre de ${sinPrecio.instrumentoId} debe tener un precio positivo.`);
}

export function validarPlan(plan: PlanParaAnalisis): void {
  sinRepetidos(plan.reglas.map((r) => r.id), "plan");
  const invalida = plan.reglas.find((r) => r.plazoHasta !== null && !esFechaDeNegocio(r.plazoHasta));
  if (invalida) throw new RangeError(`El plazo de la regla ${invalida.id} no es una fecha de negocio.`);
}
