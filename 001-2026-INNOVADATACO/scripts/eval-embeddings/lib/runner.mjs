import { trocear } from "./chunk.mjs";
import { embedLote, embed } from "./embed.mjs";
import { construirPrefijo, enriquecer } from "./enrich.mjs";
import { rankearDocumentos, posicion, agregarMetricas, proyectarDisco } from "./metrics.mjs";

/**
 * Núcleo de evaluación, compartido por evaluate.mjs (un modelo) y sweep.mjs
 * (matriz de configuraciones). Tener una sola implementación evita que las dos
 * herramientas midan cosas sutilmente distintas.
 */

/**
 * Trocea el corpus y devuelve los fragmentos listos para vectorizar.
 * El texto que se vectoriza puede llevar prefijo de metadatos; el contenido
 * original se conserva aparte para poder inspeccionarlo.
 */
export function construirFragmentos(documentos, chunkCfg, enrichFields = []) {
  const fragmentos = [];

  for (const doc of documentos) {
    const prefijo = construirPrefijo(doc, enrichFields);
    for (const frag of trocear(doc.texto, chunkCfg)) {
      fragmentos.push({
        documentoId: doc.id,
        orden: frag.orden,
        contenido: frag.contenido,
        textoParaVectorizar: enriquecer(frag.contenido, prefijo),
      });
    }
  }

  return fragmentos;
}

/**
 * Vectoriza los fragmentos, lanza las preguntas y calcula las métricas.
 * @returns {Promise<object>} métricas globales, por tipo de consulta y fallos.
 */
export async function evaluar({ modelo, cfg, fragmentos, preguntas, onProgreso }) {
  const t0 = Date.now();
  const { vectores, latenciaTotalMs } = await embedLote(
    cfg.ollamaBaseUrl,
    modelo,
    fragmentos.map((f) => f.textoParaVectorizar),
    cfg.batchSize,
    onProgreso,
  );
  const segundosIndexado = (Date.now() - t0) / 1000;
  const dimension = vectores[0].length;
  const indexados = fragmentos.map((f, i) => ({ ...f, vector: vectores[i] }));

  const resultados = [];
  const latenciasConsulta = [];

  for (const q of preguntas) {
    const tq = Date.now();
    const { embeddings } = await embed(cfg.ollamaBaseUrl, modelo, [q.pregunta]);
    latenciasConsulta.push(Date.now() - tq);

    const ranking = rankearDocumentos(embeddings[0], indexados, cfg.topK);
    const pos = posicion(ranking, q.documentoEsperado);

    resultados.push({
      id: q.id,
      tipo: q.tipo,
      pregunta: q.pregunta,
      esperado: q.documentoEsperado,
      posicion: pos,
      acierto1: pos === 1,
      aciertoK: pos > 0 && pos <= cfg.topK,
      recuperado: ranking[0]?.documentoId ?? null,
      score: ranking[0] ? Number(ranking[0].score.toFixed(4)) : null,
    });
  }

  const metricas = agregarMetricas(resultados.map((r) => r.posicion), cfg.topK);

  const porTipo = {};
  for (const tipo of [...new Set(preguntas.map((q) => q.tipo))]) {
    porTipo[tipo] = agregarMetricas(
      resultados.filter((r) => r.tipo === tipo).map((r) => r.posicion),
      cfg.topK,
    );
  }

  const promedio = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

  return {
    modelo,
    dimension,
    indexado: {
      fragmentos: fragmentos.length,
      segundos: Number(segundosIndexado.toFixed(1)),
      msPorFragmento: Number((latenciaTotalMs / fragmentos.length).toFixed(1)),
    },
    consulta: {
      msPromedio: Number(promedio(latenciasConsulta).toFixed(1)),
      msMaximo: Math.max(...latenciasConsulta),
    },
    metricas,
    porTipo,
    disco: proyectarDisco({
      fragmentos: fragmentos.length,
      documentos: new Set(fragmentos.map((f) => f.documentoId)).size,
      dimension,
      documentosObjetivo: cfg.projection.documentos,
    }),
    resultados,
    fallos: resultados.filter((r) => !r.acierto1),
  };
}

/** Filtra el banco a las preguntas cuyo documento esperado tiene texto. */
export function filtrarPreguntas(banco, documentos) {
  const ids = new Set(documentos.map((d) => d.id));
  return {
    preguntas: banco.preguntas.filter((q) => ids.has(q.documentoEsperado)),
    descartadas: banco.preguntas.filter((q) => !ids.has(q.documentoEsperado)),
  };
}
