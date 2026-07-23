#!/usr/bin/env node
/**
 * Barrido de configuraciones de troceado (decisión D-027).
 *
 * Contrasta dos variables que se sospecha pesan más que la elección de modelo, y
 * que hasta ahora estaban sin evidencia:
 *
 *   a) Troceado ESTRUCTURAL (por marcas del acto) vs VENTANA FIJA por tamaño.
 *   b) Fragmentos ENRIQUECIDOS con metadatos del acto (número, entidad, fecha)
 *      antepuestos antes de vectorizar.
 *
 * Se ejecuta con un solo modelo (por defecto nomic-embed-text, dimensión 768, ya
 * congelado en D-024) para que la única variable sea la configuración.
 *
 * Uso:
 *   node scripts/eval-embeddings/sweep.mjs
 *   node scripts/eval-embeddings/sweep.mjs --sizes=1200,1800,2600 --model=nomic-embed-text
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { cargarConfig, BASE_DIR } from "./lib/config.mjs";
import { cargarCorpus } from "./lib/corpus.mjs";
import { construirFragmentos, evaluar, filtrarPreguntas } from "./lib/runner.mjs";

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

/** Variantes de enriquecimiento a comparar (ADR_004: configurables, no literales). */
const ENRIQUECIMIENTOS = {
  ninguno: [],
  // Solo metadatos extraídos del propio texto del acto.
  metadatos: ["tipo", "numero", "anio", "entidad", "fecha"],
  // Solo el título del documento, para aislar su efecto del resto de metadatos.
  titulo: ["titulo"],
  "metadatos+titulo": ["tipo", "numero", "anio", "entidad", "fecha", "titulo"],
};

async function main() {
  const cfg = cargarConfig();
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .map((a) => a.match(/^--([^=]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );

  const modelo = args.model || cfg.models[0] || "nomic-embed-text";
  const estrategias = (args.strategies || "estructural,tamano").split(",");
  const tamanos = (args.sizes || String(cfg.chunk.maxChars)).split(",").map(Number);
  const enriquecimientos = (args.enrich || "ninguno,metadatos,metadatos+titulo").split(",");

  log("Barrido de troceado (D-027)");
  log(`Modelo:          ${modelo} (única variable controlada: la configuración)`);
  log(`Estrategias:     ${estrategias.join(", ")}`);
  log(`Tamaños:         ${tamanos.join(", ")} caracteres`);
  log(`Enriquecimiento: ${enriquecimientos.join(", ")}`);

  const { documentos, sinTexto } = cargarCorpus(cfg.corpusPath);
  const banco = JSON.parse(readFileSync(join(BASE_DIR, "questions.json"), "utf8"));
  const { preguntas } = filtrarPreguntas(banco, documentos);
  log(`\nCorpus: ${documentos.length} documentos con texto (${sinTexto.length} sin OCR) · ${preguntas.length} preguntas\n`);

  const combinaciones = [];
  for (const strategy of estrategias) {
    for (const maxChars of tamanos) {
      for (const enrichKey of enriquecimientos) {
        combinaciones.push({ strategy, maxChars, enrichKey });
      }
    }
  }

  const resultados = [];

  for (const combo of combinaciones) {
    const chunkCfg = { ...cfg.chunk, strategy: combo.strategy, maxChars: combo.maxChars };
    const campos = ENRIQUECIMIENTOS[combo.enrichKey];
    if (!campos) throw new Error(`Enriquecimiento desconocido: ${combo.enrichKey}`);

    const fragmentos = construirFragmentos(documentos, chunkCfg, campos);
    const etiqueta = `${combo.strategy}/${combo.maxChars}/${combo.enrichKey}`;
    process.stdout.write(`${etiqueta.padEnd(42)} ${String(fragmentos.length).padStart(4)} frags `);

    const r = await evaluar({ modelo, cfg, fragmentos, preguntas });

    resultados.push({ ...combo, fragmentos: fragmentos.length, ...r });

    const ident = r.porTipo.identificador;
    log(
      `· recall@1 ${r.metricas["recall@1"].toFixed(3)} · ` +
        `recall@${cfg.topK} ${r.metricas[`recall@${cfg.topK}`].toFixed(3)} · ` +
        `MRR ${r.metricas.mrr.toFixed(3)} · ` +
        `ident@1 ${ident ? ident["recall@1"].toFixed(2) : "n/a"}`,
    );
  }

  // Reporte
  const dir = join(BASE_DIR, cfg.outputDir);
  mkdirSync(dir, { recursive: true });
  const ruta = join(dir, "barrido-troceado.json");
  writeFileSync(
    ruta,
    JSON.stringify(
      {
        generado: new Date().toISOString(),
        modelo,
        corpus: { documentos: documentos.length, preguntas: preguntas.length },
        chunkBase: cfg.chunk,
        enriquecimientos: ENRIQUECIMIENTOS,
        resultados,
      },
      null,
      2,
    ),
  );

  // Tabla final ordenada por MRR
  log("\n=== RANKING (por MRR) ===");
  log(
    `${"configuración".padEnd(42)} ${"frags".padStart(5)} ${"r@1".padStart(6)} ${"r@5".padStart(6)} ${"MRR".padStart(6)} ${"ident@1".padStart(8)} ${"concep@1".padStart(9)}`,
  );
  for (const r of [...resultados].sort((a, b) => b.metricas.mrr - a.metricas.mrr)) {
    const etiqueta = `${r.strategy}/${r.maxChars}/${r.enrichKey}`;
    log(
      `${etiqueta.padEnd(42)} ${String(r.fragmentos).padStart(5)} ` +
        `${r.metricas["recall@1"].toFixed(3).padStart(6)} ` +
        `${r.metricas[`recall@${cfg.topK}`].toFixed(3).padStart(6)} ` +
        `${r.metricas.mrr.toFixed(3).padStart(6)} ` +
        `${(r.porTipo.identificador?.["recall@1"] ?? 0).toFixed(2).padStart(8)} ` +
        `${(r.porTipo.conceptual?.["recall@1"] ?? 0).toFixed(2).padStart(9)}`,
    );
  }

  log(`\nReporte: ${ruta}`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
