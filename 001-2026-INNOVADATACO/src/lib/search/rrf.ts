/**
 * Fusión de rankings por Reciprocal Rank Fusion (spec 003, FR-015, D-019).
 *
 * RRF combina el ranking textual (FTS) y el vectorial sin necesidad de que sus
 * puntuaciones sean comparables: cada documento suma `peso / (rrfK + posición)`
 * por cada rama en la que aparece. Los pesos, `rrfK` y `topK` son configurables
 * (§0.7, FR-024): cambiarlos cambia el orden sin tocar código (SC-014).
 *
 * Puro y determinista: sin BD, sin red.
 */

/** Una entrada de un ranking: el documento y su posición (0 = mejor). */
export interface EntradaRanking {
  documentoId: string;
  posicion: number;
}

export interface OpcionesRRF {
  pesoFts: number;
  pesoVectorial: number;
  rrfK: number;
  topK: number;
}

export type FuenteResultado = "fts" | "vectorial" | "ambas";

export interface ResultadoFusionado {
  documentoId: string;
  score: number;
  fuente: FuenteResultado;
}

function aporte(peso: number, rrfK: number, posicion: number): number {
  return peso / (rrfK + posicion);
}

/**
 * Fusiona los dos rankings. Cada documento aparece **una sola vez** (FR-014),
 * con la suma de sus aportes y la procedencia (fts / vectorial / ambas, para
 * auditoría — FR-025). Ordena de mayor a menor score y recorta a `topK`.
 * Empates: se rompen por `documentoId` para que el orden sea estable.
 */
export function fusionarRRF(
  ftsRanking: EntradaRanking[],
  vectorialRanking: EntradaRanking[],
  opciones: OpcionesRRF,
): ResultadoFusionado[] {
  const { pesoFts, pesoVectorial, rrfK, topK } = opciones;
  const acumulado = new Map<string, { score: number; enFts: boolean; enVec: boolean }>();

  for (const e of ftsRanking) {
    const prev = acumulado.get(e.documentoId) ?? { score: 0, enFts: false, enVec: false };
    prev.score += aporte(pesoFts, rrfK, e.posicion);
    prev.enFts = true;
    acumulado.set(e.documentoId, prev);
  }
  for (const e of vectorialRanking) {
    const prev = acumulado.get(e.documentoId) ?? { score: 0, enFts: false, enVec: false };
    prev.score += aporte(pesoVectorial, rrfK, e.posicion);
    prev.enVec = true;
    acumulado.set(e.documentoId, prev);
  }

  const fusionados: ResultadoFusionado[] = [...acumulado.entries()].map(([documentoId, v]) => ({
    documentoId,
    score: v.score,
    fuente: v.enFts && v.enVec ? "ambas" : v.enFts ? "fts" : "vectorial",
  }));

  fusionados.sort((a, b) => b.score - a.score || a.documentoId.localeCompare(b.documentoId));

  return fusionados.slice(0, Math.max(0, topK));
}
