/**
 * Carga lo que necesita el cálculo del resultado de una decisión: sus órdenes con enlace vigente y los
 * cierres VIGENTES (`reemplazadoEn` nulo) de la fuente con que se guardan los diarios (`FUENTE` de precios). Los reemplazados son historia y no se usan.
 */
import { FUENTE as FUENTE_CIERRES } from "../precios/actualizar";
import type { Db } from "./acceso";
import { ErrorPlan } from "./errores";
import { esFechaDeNegocio, sumarDias } from "./fechas";
import { HORIZONTES, MAX_RETROCESO_DIAS, calcularResultados, type ResultadoHorizonte } from "./resultado";

export interface ResultadoDecision {
  readonly decisionId: string;
  readonly d30: ResultadoHorizonte;
  readonly d90: ResultadoHorizonte;
}

export async function resultadoDeDecision(db: Db, decisionId: string, hoy: Date): Promise<ResultadoDecision> {
  if (!esFechaDeNegocio(hoy)) throw new ErrorPlan("DATOS_INVALIDOS", [{ campo: "hoy", codigo: "FECHA_INVALIDA" }]);
  const decision = await db.decision.findUnique({
    where: { id: decisionId },
    select: {
      accion: true,
      fechaDecision: true,
      cantidad: true,
      instrumentoId: true,
      enlaces: {
        where: { reemplazadoPor: { is: null } },
        select: { orden: { select: { id: true, fechaOperacion: true, cantidadCompletada: true, totalEstimado: true } } },
      },
    },
  });
  if (!decision) throw new ErrorPlan("DECISION_INEXISTENTE");
  const ordenes = decision.enlaces.map((e) => e.orden);
  const bases = [decision.fechaDecision, ...ordenes.map((o) => o.fechaOperacion)].map((f) => f.getTime());
  const cierres = await db.precioCierre.findMany({
    where: {
      instrumentoId: decision.instrumentoId,
      fuente: FUENTE_CIERRES,
      reemplazadoEn: null,
      fecha: { gte: sumarDias(new Date(Math.min(...bases)), -MAX_RETROCESO_DIAS), lte: sumarDias(new Date(Math.max(...bases)), Math.max(...HORIZONTES)) },
    },
    select: { id: true, fecha: true, precio: true, estado: true, fuente: true },
    orderBy: { fecha: "asc" },
  });
  const r = calcularResultados({ accion: decision.accion, fechaDecision: decision.fechaDecision, cantidad: decision.cantidad, ordenes, cierres, hoy });
  return { decisionId, ...r };
}
