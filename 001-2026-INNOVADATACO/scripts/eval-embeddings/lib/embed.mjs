/**
 * Cliente de embeddings de Ollama para el banco.
 *
 * Solo modelos de EMBEDDINGS: este banco nunca invoca modelos generativos
 * (ADR_002). La URL base llega resuelta desde config.mjs con la precedencia
 * de D-008.
 */

export async function embed(baseUrl, model, inputs) {
  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: inputs }),
  });

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Ollama ${res.status} al vectorizar con ${model}: ${detalle.slice(0, 200)}`);
  }

  const data = await res.json();
  const embeddings = data.embeddings || (data.embedding ? [data.embedding] : []);
  if (!embeddings.length) throw new Error(`Respuesta sin embeddings para ${model}`);

  return { embeddings, latenciaMs: Date.now() - t0 };
}

/** Vectoriza en lotes y devuelve vectores + latencia acumulada. */
export async function embedLote(baseUrl, model, textos, batchSize = 16, onProgreso) {
  const vectores = [];
  let latenciaTotal = 0;

  for (let i = 0; i < textos.length; i += batchSize) {
    const lote = textos.slice(i, i + batchSize);
    const { embeddings, latenciaMs } = await embed(baseUrl, model, lote);
    vectores.push(...embeddings);
    latenciaTotal += latenciaMs;
    if (onProgreso) onProgreso(Math.min(i + batchSize, textos.length), textos.length);
  }

  return { vectores, latenciaTotalMs: latenciaTotal };
}

/** ¿Está el modelo disponible localmente? */
export async function modeloDisponible(baseUrl, model) {
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) return false;
    const { models = [] } = await res.json();
    return models.some((m) => m.name === model || m.name === `${model}:latest` || m.model === model);
  } catch {
    return false;
  }
}
