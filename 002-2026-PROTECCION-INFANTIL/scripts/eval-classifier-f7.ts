#!/usr/bin/env tsx
/**
 * Eval harness F7 — guardas determinísticas + no-regresión.
 *
 * Ejecuta el pipeline ganador de F5 (RAG + votos, umbral 1.0) y le aplica:
 *   - Guarda DOXING existente (fuerza REVISION_MANUAL sin reclasificar).
 *   - Guarda de keywords críticas (marca prioridad alta en OTRO/REVISION_MANUAL).
 *
 * Desde Spec 013 los casos activos se leen de la tabla CasoEval. Si se pasa un
 * argumento [fixture.json], se usa el archivo JSON en su lugar (compatibilidad
 * con ejecuciones manuales offline).
 */
import { prisma } from "@/lib/prisma";
import {
    loadActiveEvalCases,
    runF7Eval,
    buildF7Report,
    saveEvalReportToFile,
    type EvalExample,
} from "@/lib/ai/eval-runner";
import fs from "fs/promises";

const MODELO_EMBEDDING = "nomic-embed-text";
const MODELO_CLASIFICACION = "ornith:9b";

async function loadExamplesFromFixture(fixturePath: string): Promise<EvalExample[]> {
    const raw = await fs.readFile(fixturePath, "utf-8");
    const fixture = JSON.parse(raw);
    return fixture.examples;
}

async function main() {
    const fixturePath = process.argv[2];

    const { examples, fixtureVersion } = fixturePath
        ? { examples: await loadExamplesFromFixture(fixturePath), fixtureVersion: 1 }
        : await loadActiveEvalCases();

    console.log(`Evaluando F7 sobre ${examples.length} ejemplos — pipeline F5 + guardas determinísticas (fixtureVersion=${fixtureVersion})\n`);

    const start = Date.now();
    const results = await runF7Eval(examples, {
        config: {
            modeloClasificacion: MODELO_CLASIFICACION,
            modeloEmbedding: MODELO_EMBEDDING,
        },
    });
    const duracionTotalMs = Date.now() - start;
    const report = buildF7Report(results, fixtureVersion, {
        modeloClasificacion: MODELO_CLASIFICACION,
        modeloEmbedding: MODELO_EMBEDDING,
        fixture: fixturePath,
        duracionTotalMs,
    });

    console.log("\n=== MÉTRICAS F7 (pipeline completo) ===");
    console.table({
        accuracy: (report.metrics.accuracy * 100).toFixed(1) + "%",
        error_silencioso: (report.metrics.errorSilencioso * 100).toFixed(1) + "%",
        revision_manual: (report.metrics.revisionManualRate * 100).toFixed(1) + "%",
        recall_otro: (report.metrics.recallOTRO * 100).toFixed(1) + "%",
        posible_agresor_par: (report.metrics.posibleAgresorParRate * 100).toFixed(1) + "%",
        latencia_p50: report.metrics.latencyP50Ms + "ms",
        latencia_p95: report.metrics.latencyP95Ms + "ms",
    });

    console.log("\n=== SEGMENTADO ===");
    console.table({
        limpio: {
            accuracy: (report.segmented.limpio.accuracy * 100).toFixed(1) + "%",
            error_silencioso: (report.segmented.limpio.errorSilencioso * 100).toFixed(1) + "%",
            revision_manual: (report.segmented.limpio.revisionManualRate * 100).toFixed(1) + "%",
            recall_otro: (report.segmented.limpio.recallOTRO * 100).toFixed(1) + "%",
            latencia_p50: report.segmented.limpio.latencyP50Ms + "ms",
            latencia_p95: report.segmented.limpio.latencyP95Ms + "ms",
        },
        ruidoso: {
            accuracy: (report.segmented.ruidoso.accuracy * 100).toFixed(1) + "%",
            error_silencioso: (report.segmented.ruidoso.errorSilencioso * 100).toFixed(1) + "%",
            revision_manual: (report.segmented.ruidoso.revisionManualRate * 100).toFixed(1) + "%",
            recall_otro: (report.segmented.ruidoso.recallOTRO * 100).toFixed(1) + "%",
            latencia_p50: report.segmented.ruidoso.latencyP50Ms + "ms",
            latencia_p95: report.segmented.ruidoso.latencyP95Ms + "ms",
        },
    });

    console.log(`\nGuardas activadas: ${report.guardas.activacionesGuardas} (DOXING verdaderas: ${report.guardas.doxingVerdaderas})`);

    const outFile = await saveEvalReportToFile(report);
    console.log(`\nReporte guardado en: ${outFile}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
