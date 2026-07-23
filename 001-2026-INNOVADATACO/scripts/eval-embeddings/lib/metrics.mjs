/**
 * Métricas de recuperación.
 *
 * Los vectores de Ollama no vienen necesariamente normalizados, así que la
 * similitud se calcula con coseno completo (no producto punto): coincide con la
 * métrica que usará la aplicación (`vector_cosine_ops`, decisión D-020).
 */

export function similitudCoseno(a, b) {
  let punto = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i++) {
    punto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }
  const denominador = Math.sqrt(normaA) * Math.sqrt(normaB);
  return denominador === 0 ? 0 : punto / denominador;
}

/**
 * Ranking de DOCUMENTOS a partir de fragmentos: cada documento puntúa con su
 * mejor fragmento (max-pooling), que es como se comportará la búsqueda real
 * (un documento aparece una sola vez, FR-014).
 */
export function rankearDocumentos(vectorConsulta, fragmentos, topK) {
  const mejorPorDocumento = new Map();

  for (const frag of fragmentos) {
    const score = similitudCoseno(vectorConsulta, frag.vector);
    const previo = mejorPorDocumento.get(frag.documentoId);
    if (!previo || score > previo.score) {
      mejorPorDocumento.set(frag.documentoId, { documentoId: frag.documentoId, score, orden: frag.orden });
    }
  }

  return [...mejorPorDocumento.values()].sort((a, b) => b.score - a.score).slice(0, topK);
}

/** Posición (1-based) del documento esperado en el ranking; 0 si no aparece. */
export function posicion(ranking, documentoEsperado) {
  const idx = ranking.findIndex((r) => r.documentoId === documentoEsperado);
  return idx === -1 ? 0 : idx + 1;
}

export function agregarMetricas(posiciones, topK) {
  const total = posiciones.length || 1;
  const recallAt = (k) => posiciones.filter((p) => p > 0 && p <= k).length / total;
  const mrr =
    posiciones.reduce((acc, p) => acc + (p > 0 ? 1 / p : 0), 0) / total;

  return {
    preguntas: posiciones.length,
    "recall@1": Number(recallAt(1).toFixed(4)),
    [`recall@${topK}`]: Number(recallAt(topK).toFixed(4)),
    mrr: Number(mrr.toFixed(4)),
    fallidas: posiciones.filter((p) => p === 0).length,
  };
}

/** Tamaño en disco proyectado del índice vectorial. */
export function proyectarDisco({ fragmentos, documentos, dimension, documentosObjetivo }) {
  const fragmentosPorDocumento = fragmentos / Math.max(documentos, 1);
  const bytesPorVector = dimension * 4 + 8; // float4 por dimensión + cabecera de pgvector
  const fragmentosProyectados = fragmentosPorDocumento * documentosObjetivo;
  const bytes = fragmentosProyectados * bytesPorVector;

  return {
    fragmentosPorDocumento: Number(fragmentosPorDocumento.toFixed(1)),
    fragmentosProyectados: Math.round(fragmentosProyectados),
    megabytesVectores: Number((bytes / 1024 / 1024).toFixed(1)),
    _nota: "Solo la columna vector; excluye el texto del fragmento y el índice HNSW.",
  };
}
