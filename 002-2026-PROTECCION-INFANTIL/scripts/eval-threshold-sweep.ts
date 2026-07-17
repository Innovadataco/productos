#!/usr/bin/env tsx
/**
 * Barrido offline de umbrales de confianza para revisión manual.
 * Uso:
 *   node --import tsx scripts/eval-threshold-sweep.ts <eval-results/f1-*.json>
 *
 * Recalcula estado y métricas para umbrales 0.5-0.9 asumiendo que cualquier
 * caso CLASIFICADO con confianza < umbral pasa a REVISION_MANUAL.
 */
import fs from "fs/promises";
import path from "path";

interface Detail {
    text: string;
    expected: string;
    predicted: string;
    confidence: number;
    estado: string;
    latencyMs: number;
    correct: boolean;
    ruido: boolean;
    fallback: boolean;
}

interface EvalReport {
    metadata: { model: string; fixture: string; totalExamples: number; timestamp: string };
    summary: {
        accuracy: number;
        precisionAutoClasificados: number;
        errorSilencioso: number;
        revisionManualRate: number;
        latencyP50Ms: number;
        latencyP95Ms: number;
    };
    details: Detail[];
}

function computeMetrics(details: Detail[]) {
    const total = details.length;
    const correct = details.filter((r) => r.correct).length;
    const accuracy = total === 0 ? 0 : correct / total;
    const clasificados = details.filter((r) => r.estado === "CLASIFICADO");
    const correctosClasificados = clasificados.filter((r) => r.correct).length;
    const precisionAutoClasificados = clasificados.length === 0 ? 0 : correctosClasificados / clasificados.length;
    const errorSilencioso = 1 - precisionAutoClasificados;
    const revisionManual = details.filter((r) => r.estado === "REVISION_MANUAL" || r.estado === "ERROR").length;

    return {
        accuracy,
        precisionAutoClasificados,
        errorSilencioso,
        revisionManualRate: total === 0 ? 0 : revisionManual / total,
        clasificadosCount: clasificados.length,
        revisionManualCount: revisionManual,
    };
}

function applyThreshold(details: Detail[], threshold: number): Detail[] {
    return details.map((r) => {
        if (r.estado === "CLASIFICADO" && r.confidence < threshold) {
            return { ...r, estado: "REVISION_MANUAL" };
        }
        return r;
    });
}

async function main() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.error("Uso: node --import tsx scripts/eval-threshold-sweep.ts <eval-results/f1-*.json>");
        process.exit(1);
    }

    const raw = await fs.readFile(inputPath, "utf-8");
    const report: EvalReport = JSON.parse(raw);

    const thresholds = [0.5, 0.6, 0.7, 0.8, 0.9];
    const results = thresholds.map((t) => {
        const recalc = applyThreshold(report.details, t);
        const m = computeMetrics(recalc);
        return {
            umbral: t,
            errorSilencioso: Number(m.errorSilencioso.toFixed(4)),
            revisionManualRate: Number(m.revisionManualRate.toFixed(4)),
            accuracy: Number(m.accuracy.toFixed(4)),
            precisionAutoClasificados: Number(m.precisionAutoClasificados.toFixed(4)),
            clasificados: m.clasificadosCount,
            revisionManual: m.revisionManualCount,
        };
    });

    console.log(`Barrido de umbrales para ${path.basename(inputPath)} (${report.metadata.totalExamples} ejemplos)\n`);
    console.log("| Umbral | error_silencioso | revision_manual_rate | accuracy | precision_auto_clasificados | clasificados | revision_manual |");
    console.log("|--------|------------------|----------------------|----------|-----------------------------|--------------|-----------------|");
    for (const r of results) {
        console.log(
            `| ${r.umbral.toFixed(1)}   | ${(r.errorSilencioso * 100).toFixed(1)}%           | ${(r.revisionManualRate * 100).toFixed(1)}%                 | ${(r.accuracy * 100).toFixed(1)}%     | ${(r.precisionAutoClasificados * 100).toFixed(1)}%                       | ${r.clasificados.toString().padStart(12)} | ${r.revisionManual.toString().padStart(15)} |`
        );
    }

    // Elegir umbral interino: error_silencioso <= 32.1% (F0.5) con menor revision_manual_rate.
    const TARGET = 0.321;
    const valid = results.filter((r) => r.errorSilencioso <= TARGET);
    const chosen = valid.length > 0
        ? valid.reduce((best, cur) => (cur.revisionManualRate < best.revisionManualRate ? cur : best))
        : null;

    console.log("\nObjetivo: error_silencioso <= 32.1% (paridad F0.5) con menor revision_manual_rate.");
    if (chosen) {
        console.log(`Umbral interino recomendado: ${chosen.umbral.toFixed(1)}`);
        console.log(`  - error_silencioso: ${(chosen.errorSilencioso * 100).toFixed(1)}%`);
        console.log(`  - revision_manual_rate: ${(chosen.revisionManualRate * 100).toFixed(1)}%`);
    } else {
        console.log("Ningún umbral alcanza el objetivo. Se requiere iteración adicional.");
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
