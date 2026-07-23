#!/usr/bin/env node
/**
 * Banco de evaluación de modelos de embeddings sobre corpus normativo real.
 *
 * Compara varios modelos de Ollama con EL MISMO troceado y las mismas preguntas,
 * y reporta recall@1, recall@k, MRR, latencias, dimensión y proyección de disco.
 *
 * Para comparar CONFIGURACIONES (troceado, enriquecimiento) con un solo modelo,
 * usa `sweep.mjs`. Ambos comparten el núcleo de evaluación (`lib/runner.mjs`)
 * para no medir cosas sutilmente distintas.
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
import { modeloDisponible } from "./lib/embed.mjs";
import { construirFragmentos, evaluar, filtrarPreguntas } from "./lib/runner.mjs";

function log(msg) {
  process.stdout.write(`${msg}\n`);
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
  const fragmentos = construirFragmentos(documentos, cfg.chunk, cfg.enrichFields || []);
  log(`Fragmentos: ${fragmentos.length} (mismo troceado para todos los modelos)`);

  // Preguntas
  const banco = JSON.parse(readFileSync(join(BASE_DIR, "questions.json"), "utf8"));
  const { preguntas, descartadas } = filtrarPreguntas(banco, documentos);
  log(
    `Preguntas: ${preguntas.length}${descartadas.length ? ` (${descartadas.length} descartadas: su documento no tiene texto)` : ""}`,
  );
  if (descartadas.length) for (const q of descartadas) log(`   · ${q.id} → ${q.documentoEsperado}`);

  // Evaluación
  const resultados = [];
  for (const modelo of cfg.models) {
    log(`\n── ${modelo} ──`);

    if (!(await modeloDisponible(cfg.ollamaBaseUrl, modelo))) {
      log(`   ⚠️  no disponible en Ollama; se omite (ejecuta: ollama pull ${modelo})`);
      resultados.push({ modelo, disponible: false });
      continue;
    }

    try {
      const r = await evaluar({
        modelo,
        cfg,
        fragmentos,
        preguntas,
        onProgreso: (hechos, total) => {
          if (hechos % (cfg.batchSize * 10) === 0 || hechos === total) {
            process.stdout.write(`   vectorizando ${hechos}/${total}\r`);
          }
        },
      });

      log(`   ${r.indexado.fragmentos} fragmentos · ${r.dimension} dims · ${r.indexado.segundos}s`);
      log(
        `   recall@1 ${r.metricas["recall@1"]} · recall@${cfg.topK} ${r.metricas[`recall@${cfg.topK}`]} · MRR ${r.metricas.mrr}`,
      );
      resultados.push({ ...r, disponible: true });
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
      enrichFields: cfg.enrichFields || [],
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
