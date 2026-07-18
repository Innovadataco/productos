#!/usr/bin/env tsx
/**
 * Eval harness para F2 (clasificación sin multitarea de PII).
 * Uso:
 *   node --env-file=.env --import tsx scripts/eval-classifier-f2.ts [fixture.json]
 */
import { clasificarReporte } from "@/lib/ai/classifier";
import fs from "fs/promises";
import path from "path";

const CATEGORIAS = [
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "OTRO",
    "EXTORSION",
    "CONTENIDO_GENERADO_IA",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
    "SPAM",
] as const;

type Categoria = (typeof CATEGORIAS)[number];

interface Example {
    text: string;
    expected: Categoria;
    ruido: boolean;
    secundariaEsperada?: Categoria;
}

interface Result {
    text: string;
    expected: Categoria;
    predicted: Categoria;
    confidence: number;
    estado: string;
    latencyMs: number;
    correct: boolean;
    ruido: boolean;
    fallback: boolean;
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function computeMetrics(results: Result[]) {
    const total = results.length;
    const correct = results.filter((r) => r.correct).length;
    const accuracy = total === 0 ? 0 : correct / total;
    const clasificados = results.filter((r) => r.estado === "CLASIFICADO");
    const correctosClasificados = clasificados.filter((r) => r.correct).length;
    const precisionAutoClasificados = clasificados.length === 0 ? 0 : correctosClasificados / clasificados.length;
    const errorSilencioso = 1 - precisionAutoClasificados;
    const revisionManual = results.filter((r) => r.estado === "REVISION_MANUAL" || r.estado === "ERROR").length;

    const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

    return {
        accuracy,
        precisionAutoClasificados,
        errorSilencioso,
        revisionManualRate: total === 0 ? 0 : revisionManual / total,
        latencyP50Ms: p50,
        latencyP95Ms: p95,
    };
}

function computeConfusionPair(results: Result[], catA: Categoria, catB: Categoria) {
    const filtered = results.filter((r) => r.expected === catA || r.expected === catB || r.predicted === catA || r.predicted === catB);
    const confusion: Record<string, Record<string, number>> = {
        [catA]: { [catA]: 0, [catB]: 0, OTRO: 0 },
        [catB]: { [catA]: 0, [catB]: 0, OTRO: 0 },
        OTRO: { [catA]: 0, [catB]: 0, OTRO: 0 },
    };
    for (const r of filtered) {
        const expected = r.expected === catA || r.expected === catB ? r.expected : "OTRO";
        const predicted = r.predicted === catA || r.predicted === catB ? r.predicted : "OTRO";
        confusion[expected][predicted]++;
    }
    return { count: filtered.length, confusion };
}

function computePerCategory(results: Result[]) {
    const confusion: Record<string, Record<string, number>> = {};
    for (const cat of CATEGORIAS) {
        confusion[cat] = {};
        for (const cat2 of CATEGORIAS) confusion[cat][cat2] = 0;
    }
    for (const r of results) {
        confusion[r.expected][r.predicted]++;
    }

    const metrics: Record<string, { precision: number; recall: number; f1: number; support: number }> = {};
    for (const cat of CATEGORIAS) {
        const tp = confusion[cat][cat];
        const fp = CATEGORIAS.reduce((sum, c) => sum + (c === cat ? 0 : confusion[c][cat]), 0);
        const fn = CATEGORIAS.reduce((sum, c) => sum + (c === cat ? 0 : confusion[cat][c]), 0);
        const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
        const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
        const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
        const support = results.filter((r) => r.expected === cat).length;
        metrics[cat] = { precision, recall, f1, support };
    }
    return { confusion, metrics };
}

async function main() {
    const fixturePath = process.argv[2] || "scripts/eval-fixture.json";
    const raw = await fs.readFile(fixturePath, "utf-8");
    const fixture = JSON.parse(raw);
    const examples: Example[] = fixture.examples;

    console.log(`Evaluando ${examples.length} ejemplos contra el clasificador actual...`);

    const results: Result[] = [];

    for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        process.stdout.write(`[${i + 1}/${examples.length}] `);
        const start = Date.now();
        try {
            const res = await clasificarReporte("ornith:9b", ex.text);
            const latencyMs = Date.now() - start;
            const correct = res.categoria === ex.expected;
            results.push({
                text: ex.text,
                expected: ex.expected,
                predicted: res.categoria,
                confidence: res.confianza,
                estado: res.estado,
                latencyMs,
                correct,
                ruido: ex.ruido,
                fallback: res.fallback,
            });
            const fallbackTag = res.fallback ? " [FALLBACK]" : "";
            console.log(`${correct ? "OK" : "FAIL"}${fallbackTag} | ${ex.expected} -> ${res.categoria} (${res.estado}) ${latencyMs}ms`);
        } catch (err) {
            const latencyMs = Date.now() - start;
            results.push({
                text: ex.text,
                expected: ex.expected,
                predicted: "OTRO",
                confidence: 0,
                estado: "ERROR",
                latencyMs,
                correct: false,
                ruido: ex.ruido,
                fallback: true,
            });
            console.log(`ERROR | ${ex.expected} -> ${err instanceof Error ? err.message : String(err)}`);
        }
        await sleep(500);
    }

    const summary = computeMetrics(results);
    const { confusion, metrics } = computePerCategory(results);
    const cleanMetrics = computeMetrics(results.filter((r) => !r.ruido));
    const noisyMetrics = computeMetrics(results.filter((r) => r.ruido));
    const fallbackCount = results.filter((r) => r.fallback).length;
    const fallbackRate = results.length === 0 ? 0 : fallbackCount / results.length;
    const materialSexualConfusion = computeConfusionPair(results, "SOLICITUD_MATERIAL", "COMPARTIMIENTO_SEXUAL");

    const report = {
        metadata: {
            model: "ornith:9b",
            fixture: fixturePath,
            totalExamples: examples.length,
            timestamp: new Date().toISOString(),
        },
        summary: {
            accuracy: Number(summary.accuracy.toFixed(4)),
            precisionAutoClasificados: Number(summary.precisionAutoClasificados.toFixed(4)),
            errorSilencioso: Number(summary.errorSilencioso.toFixed(4)),
            revisionManualRate: Number(summary.revisionManualRate.toFixed(4)),
            latencyP50Ms: summary.latencyP50Ms,
            latencyP95Ms: summary.latencyP95Ms,
            fallbackCount,
            fallbackRate: Number(fallbackRate.toFixed(4)),
        },
        byNoise: {
            clean: {
                count: results.filter((r) => !r.ruido).length,
                accuracy: Number(cleanMetrics.accuracy.toFixed(4)),
                precisionAutoClasificados: Number(cleanMetrics.precisionAutoClasificados.toFixed(4)),
                errorSilencioso: Number(cleanMetrics.errorSilencioso.toFixed(4)),
                revisionManualRate: Number(cleanMetrics.revisionManualRate.toFixed(4)),
            },
            noisy: {
                count: results.filter((r) => r.ruido).length,
                accuracy: Number(noisyMetrics.accuracy.toFixed(4)),
                precisionAutoClasificados: Number(noisyMetrics.precisionAutoClasificados.toFixed(4)),
                errorSilencioso: Number(noisyMetrics.errorSilencioso.toFixed(4)),
                revisionManualRate: Number(noisyMetrics.revisionManualRate.toFixed(4)),
            },
        },
        perCategory: Object.fromEntries(
            Object.entries(metrics).map(([k, v]) => [
                k,
                {
                    precision: Number(v.precision.toFixed(4)),
                    recall: Number(v.recall.toFixed(4)),
                    f1: Number(v.f1.toFixed(4)),
                    support: v.support,
                },
            ])
        ),
        confusionMatrix: confusion,
        materialSexualConfusion,
        details: results,
    };

    const outDir = path.join(process.cwd(), "eval-results");
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `f2-classifier-${Date.now()}.json`);
    await fs.writeFile(outFile, JSON.stringify(report, null, 2));

    console.log("\n=== RESUMEN F2 ===");
    console.log(`Accuracy:                    ${(summary.accuracy * 100).toFixed(1)}%`);
    console.log(`precision_auto_clasificados: ${(summary.precisionAutoClasificados * 100).toFixed(1)}%`);
    console.log(`error_silencioso:            ${(summary.errorSilencioso * 100).toFixed(1)}%`);
    console.log(`Revision manual:             ${(summary.revisionManualRate * 100).toFixed(1)}%`);
    console.log(`Latencia p50/p95:            ${summary.latencyP50Ms}ms / ${summary.latencyP95Ms}ms`);
    console.log("\nPor ruido:");
    console.table(report.byNoise);
    console.log("\nPor categoría:");
    console.table(metrics);
    console.log(`Fallbacks por parseo:        ${(fallbackRate * 100).toFixed(1)}% (${fallbackCount}/${results.length})`);
    console.log("\nMatriz de confusión SOLICITUD_MATERIAL / COMPARTIMIENTO_SEXUAL:");
    console.table(materialSexualConfusion.confusion);
    console.log(`\nReporte guardado en: ${outFile}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
