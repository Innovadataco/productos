#!/usr/bin/env tsx
/**
 * Eval harness para F4 — votación / self-consistency con multi-label derivado.
 * Uso:
 *   node --env-file=.env --import tsx scripts/eval-classifier-f4.ts [fixture.json] [--runs=N]
 *
 * Ejemplo para confirmación S4 (1 run, determinismo confirmado):
 *   node --env-file=.env --import tsx scripts/eval-classifier-f4.ts scripts/eval-fixture.json --runs=1
 */
import { clasificarConVotos } from "@/lib/ai/classifier";
import { detectarDoxing } from "@/lib/ai/pii-patterns";
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
    posibleAgresorPar: boolean;
    posibleAgresorParMayoritario: boolean;
    secundarias: Categoria[];
    secundariaCorrecta: boolean;
    votos: unknown[];
    guardaDoxing: boolean;
    guardaDoxingVerdadera: boolean;
}

interface RunMetrics {
    accuracy: number;
    precisionAutoClasificados: number;
    errorSilencioso: number;
    revisionManualRate: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    posibleAgresorParRate: number;
    posibleAgresorParMayoritarioRate: number;
    secondaryRecall: number;
    recallOTRO: number;
}

const BASELINE_ERROR_SILENCIOSO_F3 = 0.2632;
const FRENTE_P4 = BASELINE_ERROR_SILENCIOSO_F3 + 0.01;
const DEFAULT_RUNS = 3;

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function computeMetrics(results: Result[]): RunMetrics {
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

    const posibleAgresorParRate = total === 0 ? 0 : results.filter((r) => r.posibleAgresorPar).length / total;
    const posibleAgresorParMayoritarioRate =
        total === 0 ? 0 : results.filter((r) => r.posibleAgresorParMayoritario).length / total;

    const conSecundariaEsperada = results.filter((r) => r.secundariaCorrecta !== undefined);
    const secondaryRecall =
        conSecundariaEsperada.length === 0
            ? 0
            : conSecundariaEsperada.filter((r) => r.secundariaCorrecta).length / conSecundariaEsperada.length;

    const otroSupport = results.filter((r) => r.expected === "OTRO").length;
    const otroRecall = otroSupport === 0 ? 0 : results.filter((r) => r.expected === "OTRO" && r.predicted === "OTRO").length / otroSupport;

    return {
        accuracy,
        precisionAutoClasificados,
        errorSilencioso,
        revisionManualRate: total === 0 ? 0 : revisionManual / total,
        latencyP50Ms: p50,
        latencyP95Ms: p95,
        posibleAgresorParRate,
        posibleAgresorParMayoritarioRate,
        secondaryRecall,
        recallOTRO: otroRecall,
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

function computeGuardaDoxing(results: Result[]) {
    const activadas = results.filter((r) => r.guardaDoxing);
    const verdaderas = activadas.filter((r) => r.guardaDoxingVerdadera);
    return {
        activadas: activadas.length,
        verdaderas: verdaderas.length,
        precision: activadas.length === 0 ? 0 : verdaderas.length / activadas.length,
    };
}

function averageRuns(runs: RunMetrics[]): RunMetrics {
    const keys = Object.keys(runs[0]) as (keyof RunMetrics)[];
    const out = {} as RunMetrics;
    for (const k of keys) {
        const vals = runs.map((r) => r[k]);
        out[k] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return out;
}

function stdRuns(runs: RunMetrics[], avg: RunMetrics): Partial<RunMetrics> {
    const keys = Object.keys(runs[0]) as (keyof RunMetrics)[];
    const out = {} as Partial<RunMetrics>;
    for (const k of keys) {
        const vals = runs.map((r) => r[k]);
        const mean = avg[k];
        const variance = vals.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / vals.length;
        out[k] = Math.sqrt(variance);
    }
    return out;
}

async function runOnce(
    examples: Example[],
    fixturePath: string,
    runIndex: number,
    nRuns: number
): Promise<{ results: Result[]; metrics: RunMetrics }> {
    console.log(`\n=== RUN ${runIndex + 1}/${nRuns} ===`);
    const results: Result[] = [];

    for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        process.stdout.write(`[${i + 1}/${examples.length}] `);
        const start = Date.now();
        try {
            const res = await clasificarConVotos("ornith:9b", ex.text, {
                nVotos: 5,
                temperatura: 0.7,
                seeds: [42, 123, 456, 789, 1024],
                minScoreCategoria: 0.3,
                umbralRevision: 0.8,
                ollamaNumParallel: 2,
            });
            const latencyMs = Date.now() - start;
            const correct = res.categoria === ex.expected;

            const doxing = detectarDoxing(ex.text);
            const guardaDoxing = doxing.esDoxing && res.categoria !== "DOXING";
            const guardaDoxingVerdadera = guardaDoxing && ex.expected === "DOXING";

            const votos = res.votos || [];
            const trueVotes = votos.filter((v: { posibleAgresorPar?: boolean }) => v.posibleAgresorPar).length;
            const posibleAgresorParMayoritario = trueVotes / votos.length >= 0.5;

            const secundarias = res.categoriasSecundarias.map((s) => s.categoria);
            const secundariaCorrecta = ex.secundariaEsperada ? secundarias.includes(ex.secundariaEsperada) : false;

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
                posibleAgresorPar: res.posibleAgresorPar,
                posibleAgresorParMayoritario,
                secundarias,
                secundariaCorrecta: ex.secundariaEsperada ? secundariaCorrecta : false,
                votos,
                guardaDoxing,
                guardaDoxingVerdadera,
            });
            const fallbackTag = res.fallback ? " [FALLBACK]" : "";
            const agresorParTag = res.posibleAgresorPar ? " [PAR]" : "";
            console.log(
                `${correct ? "OK" : "FAIL"}${fallbackTag}${agresorParTag} | ${ex.expected} -> ${res.categoria} (${res.estado}) ${latencyMs}ms | sec=${secundarias.join(",") || "-"}`
            );
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
                posibleAgresorPar: false,
                posibleAgresorParMayoritario: false,
                secundarias: [],
                secundariaCorrecta: false,
                votos: [],
                guardaDoxing: false,
                guardaDoxingVerdadera: false,
            });
            console.log(`ERROR | ${ex.expected} -> ${err instanceof Error ? err.message : String(err)}`);
        }
        await sleep(500);
    }

    return { results, metrics: computeMetrics(results) };
}

async function main() {
    const args = process.argv.slice(2);
    const runsArg = args.find((a) => a.startsWith("--runs="));
    const nRuns = runsArg ? parseInt(runsArg.split("=")[1], 10) : DEFAULT_RUNS;
    const fixturePath = args.find((a) => !a.startsWith("--")) || "scripts/eval-fixture.json";

    const raw = await fs.readFile(fixturePath, "utf-8");
    const fixture = JSON.parse(raw);
    const examples: Example[] = fixture.examples;

    console.log(`Evaluando ${examples.length} ejemplos contra el clasificador F4 (votación) — ${nRuns} runs...`);

    const allRuns: { results: Result[]; metrics: RunMetrics }[] = [];
    for (let run = 0; run < nRuns; run++) {
        const runData = await runOnce(examples, fixturePath, run, nRuns);
        allRuns.push(runData);
    }

    const avgMetrics = averageRuns(allRuns.map((r) => r.metrics));
    const stdMetrics = stdRuns(allRuns.map((r) => r.metrics), avgMetrics);

    // Métricas del último run para matrices y detalles
    const lastResults = allRuns[allRuns.length - 1].results;
    const { confusion, metrics } = computePerCategory(lastResults);
    const cleanMetrics = computeMetrics(lastResults.filter((r) => !r.ruido));
    const noisyMetrics = computeMetrics(lastResults.filter((r) => r.ruido));
    const fallbackCount = lastResults.filter((r) => r.fallback).length;
    const fallbackRate = lastResults.length === 0 ? 0 : fallbackCount / lastResults.length;
    const materialSexualConfusion = computeConfusionPair(lastResults, "SOLICITUD_MATERIAL", "COMPARTIMIENTO_SEXUAL");
    const guardaDoxingMetrics = computeGuardaDoxing(lastResults);

    const perRunSummary = allRuns.map((r, i) => ({
        run: i + 1,
        accuracy: Number(r.metrics.accuracy.toFixed(4)),
        precisionAutoClasificados: Number(r.metrics.precisionAutoClasificados.toFixed(4)),
        errorSilencioso: Number(r.metrics.errorSilencioso.toFixed(4)),
        revisionManualRate: Number(r.metrics.revisionManualRate.toFixed(4)),
        latencyP50Ms: r.metrics.latencyP50Ms,
        latencyP95Ms: r.metrics.latencyP95Ms,
        posibleAgresorParRate: Number(r.metrics.posibleAgresorParRate.toFixed(4)),
        posibleAgresorParMayoritarioRate: Number(r.metrics.posibleAgresorParMayoritarioRate.toFixed(4)),
        secondaryRecall: Number(r.metrics.secondaryRecall.toFixed(4)),
        recallOTRO: Number(r.metrics.recallOTRO.toFixed(4)),
    }));

    const report = {
        metadata: {
            model: "ornith:9b",
            nVotos: 5,
            nRuns,
            temperaturaVotos: 0.7,
            fixture: fixturePath,
            totalExamples: examples.length,
            timestamp: new Date().toISOString(),
        },
        perRun: perRunSummary,
        summary: {
            accuracy: Number(avgMetrics.accuracy.toFixed(4)),
            accuracyStd: Number(stdMetrics.accuracy?.toFixed(4)),
            precisionAutoClasificados: Number(avgMetrics.precisionAutoClasificados.toFixed(4)),
            errorSilencioso: Number(avgMetrics.errorSilencioso.toFixed(4)),
            errorSilenciosoStd: Number(stdMetrics.errorSilencioso?.toFixed(4)),
            revisionManualRate: Number(avgMetrics.revisionManualRate.toFixed(4)),
            latencyP50Ms: Math.round(avgMetrics.latencyP50Ms),
            latencyP95Ms: Math.round(avgMetrics.latencyP95Ms),
            fallbackCount,
            fallbackRate: Number(fallbackRate.toFixed(4)),
            posibleAgresorParRate: Number(avgMetrics.posibleAgresorParRate.toFixed(4)),
            posibleAgresorParMayoritarioRate: Number(avgMetrics.posibleAgresorParMayoritarioRate.toFixed(4)),
            secondaryRecall: Number(avgMetrics.secondaryRecall.toFixed(4)),
            recallOTRO: Number(avgMetrics.recallOTRO.toFixed(4)),
        },
        byNoise: {
            clean: {
                count: lastResults.filter((r) => !r.ruido).length,
                accuracy: Number(cleanMetrics.accuracy.toFixed(4)),
                precisionAutoClasificados: Number(cleanMetrics.precisionAutoClasificados.toFixed(4)),
                errorSilencioso: Number(cleanMetrics.errorSilencioso.toFixed(4)),
                revisionManualRate: Number(cleanMetrics.revisionManualRate.toFixed(4)),
            },
            noisy: {
                count: lastResults.filter((r) => r.ruido).length,
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
        guardaDoxing: {
            activadas: guardaDoxingMetrics.activadas,
            verdaderas: guardaDoxingMetrics.verdaderas,
            precision: Number(guardaDoxingMetrics.precision.toFixed(4)),
        },
        details: lastResults,
    };

    const outDir = path.join(process.cwd(), "eval-results");
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `f4-votacion-classifier-${Date.now()}.json`);
    await fs.writeFile(outFile, JSON.stringify(report, null, 2));

    console.log(`\n=== RESUMEN F4 (media de ${nRuns} runs) ===`);
    console.log(`Accuracy:                    ${(avgMetrics.accuracy * 100).toFixed(1)}% (σ ${(stdMetrics.accuracy! * 100).toFixed(2)})`);
    console.log(`precision_auto_clasificados: ${(avgMetrics.precisionAutoClasificados * 100).toFixed(1)}%`);
    console.log(`error_silencioso:            ${(avgMetrics.errorSilencioso * 100).toFixed(1)}% (σ ${(stdMetrics.errorSilencioso! * 100).toFixed(2)})`);
    console.log(`revisión_manual:             ${(avgMetrics.revisionManualRate * 100).toFixed(1)}%`);
    console.log(`recall OTRO:                 ${(avgMetrics.recallOTRO * 100).toFixed(1)}%`);
    console.log(`recall secundarias:          ${(avgMetrics.secondaryRecall * 100).toFixed(1)}%`);
    console.log(`Latencia p50/p95:            ${Math.round(avgMetrics.latencyP50Ms)}ms / ${Math.round(avgMetrics.latencyP95Ms)}ms`);
    console.log(`posibleAgresorPar OR:        ${(avgMetrics.posibleAgresorParRate * 100).toFixed(1)}%`);
    console.log(`posibleAgresorPar mayoritario: ${(avgMetrics.posibleAgresorParMayoritarioRate * 100).toFixed(1)}%`);
    console.log("\nPor run:");
    console.table(perRunSummary);
    console.log("\nPor ruido (último run):");
    console.table(report.byNoise);
    console.log("\nPor categoría (último run):");
    console.table(metrics);
    console.log(`Fallbacks por parseo:        ${(fallbackRate * 100).toFixed(1)}% (${fallbackCount}/${lastResults.length})`);
    console.log("\nGuarda de escalamiento DOXING:");
    console.log(`Activada en ${guardaDoxingMetrics.activadas} casos; ${guardaDoxingMetrics.verdaderas} verdaderos DOXING; precisión ${(guardaDoxingMetrics.precision * 100).toFixed(1)}%`);
    console.log("\nMatriz de confusión SOLICITUD_MATERIAL / COMPARTIMIENTO_SEXUAL:");
    console.table(materialSexualConfusion.confusion);
    console.log(`\nReporte guardado en: ${outFile}`);

    if (avgMetrics.errorSilencioso > FRENTE_P4) {
        console.error(
            `\nFRENAR — error_silencioso medio (${(avgMetrics.errorSilencioso * 100).toFixed(1)}%) empeoró > 1 pp vs F3-revert (${(BASELINE_ERROR_SILENCIOSO_F3 * 100).toFixed(2)}%)`
        );
        process.exit(1);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
