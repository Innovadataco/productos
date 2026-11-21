/**
 * Resultado de UNA decisión a 30 y 90 días: el mismo cálculo que el lote (`resultados-lote.ts`), con sus órdenes
 * de enlace vigente, los cierres VIGENTES de Yahoo (los reemplazados son historia y no se usan) y los dividendos.
 */
import type { Db } from "./acceso";
import { ErrorPlan } from "./errores";
import { esFechaDeNegocio } from "./fechas";
import { resultadosDeDecisiones, type ResultadoDecision } from "./resultados-lote";

export type { ResultadoDecision } from "./resultados-lote";

export async function resultadoDeDecision(db: Db, decisionId: string, hoy: Date): Promise<ResultadoDecision> {
  if (!esFechaDeNegocio(hoy)) throw new ErrorPlan("DATOS_INVALIDOS", [{ campo: "hoy", codigo: "FECHA_INVALIDA" }]);
  const r = (await resultadosDeDecisiones(db, [decisionId], hoy)).get(decisionId);
  if (!r) throw new ErrorPlan("DECISION_INEXISTENTE");
  return r;
}
