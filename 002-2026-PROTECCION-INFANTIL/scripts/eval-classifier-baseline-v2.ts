#!/usr/bin/env tsx
/**
 * Baseline v2 del clasificador sobre el fixture curado.
 * Configuración exacta de producción: ornith:9b / umbral 1.0 / 5 votos / temp 0.7 / rag_top_k 3.
 * Uso:
 *   node --env-file=.env --import tsx scripts/eval-classifier-baseline-v2.ts
 */
import { prisma } from "../src/lib/prisma";
import {
    getCurrentProductionConfig,
    loadActiveEvalCases,
    runF7Eval,
    buildF7Report,
    type ExperimentConfigSnapshot,
} from "../src/lib/ai/eval-runner";
import fs from "fs/promises";
import path from "path";

async function saveBaselineV2Report(report: ReturnType<typeof buildF7Report> & { metadata: { config: ExperimentConfigSnapshot } }): Promise<string> {
    const outDir = path.join(process.cwd(), "eval-results");
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `baseline-v2-${Date.now()}.json`);
    await fs.writeFile(outFile, JSON.stringify(report, null, 2));
    return outFile;
}

async function main() {
    const inicio = Date.now();
    const config = await getCurrentProductionConfig();
    const { examples, fixtureVersion } = await loadActiveEvalCases();

    console.log(`[BASELINE V2] Config producción:`);
    console.log(`  modelo=${config.modeloClasificacion}`);
    console.log(`  umbralRevision=${config.umbralRevision}`);
    console.log(`  nVotos=${config.nVotos}`);
    console.log(`  temperatura=${config.temperaturaVotos}`);
    console.log(`  ragTopK=${config.ragTopK}`);
    console.log(`  fixtureVersion=${fixtureVersion} (${examples.length} casos activos)`);

    const results = await runF7Eval(examples, { config });
    const duracionTotalMs = Date.now() - inicio;

    const report = {
        ...buildF7Report(results, fixtureVersion, {
            modeloClasificacion: config.modeloClasificacion,
            modeloEmbedding: config.modeloEmbedding,
            duracionTotalMs,
        }),
        metadata: {
            ...buildF7Report(results, fixtureVersion, {
                modeloClasificacion: config.modeloClasificacion,
                modeloEmbedding: config.modeloEmbedding,
                duracionTotalMs,
            }).metadata,
            config,
            tipo: "baseline-v2",
        },
    };

    const outFile = await saveBaselineV2Report(report as never);

    console.log("\n=== BASELINE V2 RESUMEN ===");
    console.log(`Accuracy:                    ${(report.metrics.accuracy * 100).toFixed(1)}%`);
    console.log(`Error silencioso:            ${(report.metrics.errorSilencioso * 100).toFixed(1)}%`);
    console.log(`Revisión manual:             ${(report.metrics.revisionManualRate * 100).toFixed(1)}%`);
    console.log(`Latencia p50:                ${report.metrics.latencyP50Ms}ms`);
    console.log(`Latencia p95:                ${report.metrics.latencyP95Ms}ms`);
    console.log(`Duración total:              ${(duracionTotalMs / 60000).toFixed(1)} min`);
    console.log(`Reporte guardado en:         ${outFile}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
