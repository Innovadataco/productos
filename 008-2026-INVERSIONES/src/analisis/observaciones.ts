/**
 * Puntos para revisar: las observaciones del catálogo cerrado (catalogo.ts) que se cumplen en el análisis y en las
 * reglas vigentes del plan. Puro. Cada una dice qué dato cruzó qué umbral, con los ids que la sostienen.
 * - `hoy` debe ser el día del análisis: un análisis de otro día daría frescuras y plazos falsos.
 * - Las reglas se miden como en /plan: `estadoDelNivel` (src/plan/niveles.ts) solo con el cierre AL_DIA.
 * - Orden: el del catálogo y, dentro de cada clave, por sus ids.
 */
import type { Observacion } from "./catalogo";
import type { Analisis, PlanParaAnalisis } from "./tipos";

export function observaciones(analisis: Analisis, plan: PlanParaAnalisis, hoy: Date): readonly Observacion[] {
  throw new Error("sin implementar");
}
