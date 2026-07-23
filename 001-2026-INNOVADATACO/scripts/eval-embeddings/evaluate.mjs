#!/usr/bin/env node
/**
 * Banco de evaluación de modelos de embeddings sobre corpus normativo real.
 *
 * Compara varios modelos de Ollama con EL MISMO troceado y las mismas preguntas,
 * y reporta recall@1, recall@k, MRR, latencias, dimensión y proyección de disco.
 *
 * Solo modelos de EMBEDDINGS: nunca invoca modelos generativos (ADR_002).
 * El corpus es de SOLO LECTURA y su ruta es configuración, no un literal (ADR_004).
 *
 * Uso:
 *   node scripts/eval-embeddings/evaluate.mjs --corpus-path=/ruta/al/corpus
 *   node scripts/eval-embeddings/evaluate.mjs --models=nomic-embed-text,bge-m3
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { cargarConfig, BASE_DIR } from "./lib/config.mjs";
import { cargarCorpus } from "./lib/corpus.mjs";
import { trocear } from "./lib/chunk.mjs";
import { embedLote, embed, modeloDisponible } from "./lib/embed.mjs";
import { rankearDocumentos, posicion, agregarMetricas, proyectarDisco } from "./lib/metrics.mjs";

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

async function evaluarModelo(modelo, cfg, fragmentos, preguntas) {
  log(`\n── ${modelo} ──`);

  if (!(await modeloDisponible(cfg.ollamaBaseUrl, modelo))) {
    log(`   ⚠️  no disponible en Ollama; se omite (ejecuta: ollama pull ${modelo})`);
    return { modelo, disponible: false };
  }

  // 1) Vectorizar fragmentos
  const textos = fragmentos.map((f) => f.contenido);
  const t0 = Date.now();
  const { vectores, latenciaTotalMs } = await embedLote(
    cfg.ollamaBaseUrl,
    modelo,
    textos,
    cfg.batchSize,
    (hechos, total) => {
      if (hechos % (cfg.batchSize * 10) === 0 || hechos === total) {
        process.stdout.write(`   vectorizando ${hechos}/${total}\r`);
      }
    },
  );
  const segundosIndexado = (Date.now() - t0) / 1000;
  const dimension = vectores[0].length;
  log(`   ${fragmentos.length} fragmentos · ${dimension} dims · ${segundosIndexado.toFixed(1)}s`);

  const indexados = fragmentos.map((f, i) => ({ ...f, vector: vectores[i] }));

  // 2) Consultar
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

  const posiciones = resultados.map((r) => r.posicion);
  const metricas = agregarMetricas(posiciones, cfg.topK);

  // Métricas por tipo de consulta
  const porTipo = {};
  for (const tipo of [...new Set(preguntas.map((q) => q.tipo))]) {
    const subset = resultados.filter((r) => r.tipo === tipo).map((r) => r.posicion);
    porTipo[tipo] = agregarMetricas(subset, cfg.topK);
  }

  const promedio = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

  const salida = {
    modelo,
    disponible: true,
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
    fallos: resultados.filter((r) => !r.acierto1),
  };

  log(
    `   recall@1 ${metricas["recall@1"]} · recall@${cfg.topK} ${metricas[`recall@${cfg.topK}`]} · MRR ${metricas.mrr}`,
  );
  return salida;
}

async function main() {
  const cfg = cargarConfig();

  log("Banco de evaluación de embeddings");
  log(`Corpus:  ${cfg.corpusPath}`);
  log(`Ollama:  ${cfg.ollamaBaseUrl}`);
  log(`Modelos: ${cfg.models.join(", ")}`);
  log(
    `Troceado: ${cfg.chunk.strategy}, max ${cfg.chunk.maxChars} chars, solape ${cfg.chunk.overlapChars}`,
  );

  // Corpus
  const { documentos, sinTexto } = cargarCorpus(cfg.corpusPath);
  log(`\nDocumentos con texto: ${documentos.length}`);
  if (sinTexto.length) {
    log(`Sin capa de texto (requieren OCR, excluidos): ${sinTexto.length}`);
    for (const d of sinTexto) log(`   · ${d.archivo} (${(d.bytesPdf / 1e6).toFixed(1)} MB de PDF)`);
  }

  // Troceado: idéntico para todos los modelos
  const fragmentos = [];
  for (const doc of documentos) {
    for (const frag of trocear(doc.texto, cfg.chunk)) {
      fragmentos.push({ documentoId: doc.id, orden: frag.orden, contenido: frag.contenido });
    }
  }
  log(`Fragmentos: ${fragmentos.length} (mismo troceado para todos los modelos)`);

  // Preguntas
  const banco = JSON.parse(readFileSync(join(BASE_DIR, "questions.json"), "utf8"));
  const idsCorpus = new Set(documentos.map((d) => d.id));
  const preguntas = banco.preguntas.filter((q) => idsCorpus.has(q.documentoEsperado));
  const descartadas = banco.preguntas.filter((q) => !idsCorpus.has(q.documentoEsperado));

  log(`Preguntas: ${preguntas.length}${descartadas.length ? ` (${descartadas.length} descartadas: su documento no tiene texto)` : ""}`);
  if (descartadas.length) for (const q of descartadas) log(`   · ${q.id} → ${q.documentoEsperado}`);

  // Evaluación
  const resultados = [];
  for (const modelo of cfg.models) {
    try {
      resultados.push(await evaluarModelo(modelo, cfg, fragmentos, preguntas));
    } catch (err) {
      log(`   ❌ error con ${modelo}: ${err.message}`);
      resultados.push({ modelo, disponible: false, error: err.message });
    }
  }

  // Reporte
  const reporte = {
    generado: new Date().toISOString(),
    configuracion: {
      corpusPath: cfg.corpusPath,
      ollamaBaseUrl: cfg.ollamaBaseUrl,
      chunk: cfg.chunk,
      topK: cfg.topK,
      proyeccionDocumentos: cfg.projection.documentos,
    },
    corpus: {
      documentosConTexto: documentos.length,
      documentosSinTexto: sinTexto,
      fragmentos: fragmentos.length,
      preguntasEvaluadas: preguntas.length,
    },
    resultados,
  };

  const dir = join(BASE_DIR, cfg.outputDir);
  mkdirSync(dir, { recursive: true });
  const ruta = join(dir, "ultima-evaluacion.json");
  writeFileSync(ruta, JSON.stringify(reporte, null, 2));

  log("\n=== RESUMEN ===");
  for (const r of resultados.filter((x) => x.disponible)) {
    log(
      `${r.modelo.padEnd(24)} dims ${String(r.dimension).padStart(4)} · ` +
        `recall@1 ${r.metricas["recall@1"].toFixed(3)} · ` +
        `recall@${cfg.topK} ${r.metricas[`recall@${cfg.topK}`].toFixed(3)} · ` +
        `MRR ${r.metricas.mrr.toFixed(3)} · ` +
        `${r.indexado.msPorFragmento} ms/frag · ${r.disco.megabytesVectores} MB @${cfg.projection.documentos} docs`,
    );
  }
  log(`\nReporte: ${ruta}`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
