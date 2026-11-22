/**
 * Resumen del resultado de las decisiones a 30 y 90 días (src/plan/resultado.ts), sin volver a calcularlo. Puro.
 * - Cuenta FUNCIONO, NO_FUNCIONO y NEUTRO por horizonte, y los que no se calcularon (pendientes, sin precio, sin orden).
 * - Una calculada sin veredicto (escisión en la ventana) se cuenta aparte: su resultado en pesos está sesgado por la
 *   caída de la escisión y no entra al total.
 * - El total en pesos es por horizonte (nunca entre horizontes), en Decimal.
 */
import type { ResultadoDecision } from "../plan/resultados-lote";
import type { ResumenDecisiones } from "./tipos";

export function resumirDecisiones(decisiones: readonly ResultadoDecision[]): ResumenDecisiones {
  throw new Error("sin implementar");
}
