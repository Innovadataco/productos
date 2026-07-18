#!/usr/bin/env tsx
/**
 * Eval harness F6 — cascada de desempate.
 *
 * A/B: qwen2.5:32b vs ornith:35b sobre el subconjunto no convergente de F5.
 * keep_alive=0, temperature=0, seed fijo.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/eval-classifier-f6.ts [fixture.json]
 */
import { prisma } from "@/lib/prisma";
import { clasificarConVotos, type VotoIndividual } from "@/lib/ai/classifier";
import { generarEmbedding } from "@/lib/ai/embedder";
import { buscarEjemplosSimilares } from "@/lib/ai/dataset-retrieval";
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

interface ResultArm {
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
    usoCascada: boolean;
    modeloCascada?: string;
    desempateLatencyMs?: number;
    desempateLoadDuration?: number | null;
}

interface RunMetrics {
    accuracy: number;
    precisionAutoClasificados: number;
    errorSilencioso: number;
    revisionManualRate: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    posibleAgresorParRate: number;
    recallOTRO: number;
}

interface SubsetMetrics {
    noConvergentes: number;
    resueltos: number;
    resueltosBien: number;
    malConfirmados: number;
    noResueltos: number;
}

const BASELINE_ERROR_SILENCIOSO_F5 = 0.2191780821917808;
const P4_THRESHOLD = BASELINE_ERROR_SILENCIOSO_F5 + 0.01;
const MODELO_EMBEDDING = "nomic-embed-text";
const MODELO_CLASIFICACION = "ornith:9b";
const MODELOS_DESEMPATE = ["qwen2.5:32b", "ornith:35b"];

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function computeMetrics(results: ResultArm[]): RunMetrics {
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
        recallOTRO: otroRecall,
    };
}

function computeSubsetMetrics(results: ResultArm[]): SubsetMetrics {
    const noConvergentes = results.filter((r) => r.usoCascada);
    const resueltos = noConvergentes.filter((r) => r.estado === "CLASIFICADO");
    return {
        noConvergentes: noConvergentes.length,
        resueltos: resueltos.length,
        resueltosBien: resueltos.filter((r) => r.correct).length,
        malConfirmados: resueltos.filter((r) => !r.correct).length,
        noResueltos: noConvergentes.filter((r) => r.estado === "REVISION_MANUAL").length,
    };
}

async function warmupModel(modelo: string, texto: string, ejemplos: { texto: string; categoria: string }[]) {
    console.log(`[F6] Warm-up modelo ${modelo}...`);
    const start = Date.now();
    const res = await clasificarConVotos(MODELO_CLASIFICACION, texto, {
        nVotos: 5,
        temperatura: 0.7,
        seeds: [42, 123, 456, 789, 1024],
        minScoreCategoria: 0.3,
        umbralRevision: 1.0,
        ollamaNumParallel: 2,
        ejemplos,
        modeloDesempate: modelo,
        keepAliveDesempate: 0,
    });
    const latencyMs = Date.now() - start;
    return { latencyMs, desempateLatencyMs: res.desempateLatencyMs ?? 0, loadDuration: res.desempateLoadDuration ?? null };
}

async function runModel(
    modeloDesempate: string,
    examples: Example[]
): Promise<{ results: ResultArm[]; subsetMetrics: SubsetMetrics; desempateLatencies: number[]; desempateLoadDurations: (number | null)[] }> {
    const results: ResultArm[] = [];
    const desempateLatencies: number[] = [];
    const desempateLoadDurations: (number | null)[] = [];

    for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        process.stdout.write(`[${modeloDesempate}] [${i + 1}/${examples.length}] `);
        const start = Date.now();
        try {
            const vector = await generarEmbedding(MODELO_EMBEDDING, ex.text);
            const ejemplos = await buscarEjemplosSimilares(vector, { topK: 3, excluirSimilitudMayorA: 0.98 });

            const res = await clasificarConVotos(MODELO_CLASIFICACION, ex.text, {
                nVotos: 5,
                temperatura: 0.7,
                seeds: [42, 123, 456, 789, 1024],
                minScoreCategoria: 0.3,
                umbralRevision: 1.0,
                ollamaNumParallel: 2,
                ejemplos,
                modeloDesempate,
                keepAliveDesempate: 0,
            });
            const latencyMs = Date.now() - start;
            const correct = res.categoria === ex.expected;

            const doxing = detectarDoxing(ex.text);
            const guardaDoxing = doxing.esDoxing && res.categoria !== "DOXING";
            const guardaDoxingVerdadera = guardaDoxing && ex.expected === "DOXING";

            if (res.usoCascada && res.desempateLatencyMs !== undefined) {
                desempateLatencies.push(res.desempateLatencyMs);
                desempateLoadDurations.push(res.desempateLoadDuration ?? null);
            }

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
                usoCascada: res.usoCascada ?? false,
                modeloCascada: res.modeloCascada,
                desempateLatencyMs: res.desempateLatencyMs,
                desempateLoadDuration: res.desempateLoadDuration,
            });
            const cascadaTag = res.usoCascada ? " [CASCADA]" : "";
            const agresorParTag = res.posibleAgresorPar ? " [PAR]" : "";
            console.log(`${correct ? "OK" : "FAIL"}${cascadaTag}${agresorParTag} | ${ex.expected} -> ${res.categoria} (${res.estado}) ${latencyMs}ms | ej=${ejemplos.length}`);
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
                usoCascada: false,
            });
            console.log(`ERROR | ${ex.expected} -> ${err instanceof Error ? err.message : String(err)}`);
        }
        await sleep(500);
    }

    return { results, subsetMetrics: computeSubsetMetrics(results), desempateLatencies, desempateLoadDurations };
}

function formatMs(ms: number) {
    return Math.round(ms) + "ms";
}

async function main() {
    const fixturePath = process.argv[2] || "scripts/eval-fixture.json";
    const raw = await fs.readFile(fixturePath, "utf-8");
    const fixture = JSON.parse(raw);
    const examples: Example[] = fixture.examples;

    console.log(`Evaluando F6 sobre ${examples.length} ejemplos — modelos: ${MODELOS_DESEMPATE.join(", ")}\n`);

    const perModel: Record<
        string,
        {
            results: ResultArm[];
            metrics: RunMetrics;
            subsetMetrics: SubsetMetrics;
            warmupLatencyMs: number;
            desempateLatencies: number[];
            desempateLoadDurations: (number | null)[];
        }
    > = {};

    for (const modelo of MODELOS_DESEMPATE) {
        const vector = await generarEmbedding(MODELO_EMBEDDING, "warm-up");
        const ejemplos = await buscarEjemplosSimilares(vector, { topK: 1 });
        const { latencyMs: warmupLatencyMs } = await warmupModel(modelo, "mensaje de prueba para calentar modelo", ejemplos);

        const { results, subsetMetrics, desempateLatencies, desempateLoadDurations } = await runModel(modelo, examples);
        perModel[modelo] = {
            results,
            metrics: computeMetrics(results),
            subsetMetrics,
            warmupLatencyMs,
            desempateLatencies,
            desempateLoadDurations,
        };
    }

    console.log("\n=== TABLA A/B — DESEMPATE ===");
    const tableAB = Object.entries(perModel).map(([modelo, data]) => {
        const latSorted = [...data.desempateLatencies].sort((a, b) => a - b);
        const loadSorted = data.desempateLoadDurations.filter((d): d is number => d !== null).sort((a, b) => a - b);
        return {
            modelo,
            noConvergentes: data.subsetMetrics.noConvergentes,
            resueltos: data.subsetMetrics.resueltos,
            resueltosBien: data.subsetMetrics.resueltosBien,
            malConfirmados: data.subsetMetrics.malConfirmados,
            noResueltos: data.subsetMetrics.noResueltos,
            pctResuelto: ((data.subsetMetrics.resueltos / data.subsetMetrics.noConvergentes) * 100).toFixed(1) + "%",
            pctResueltoBien: ((data.subsetMetrics.resueltosBien / data.subsetMetrics.noConvergentes) * 100).toFixed(1) + "%",
            pctMalConfirmado: ((data.subsetMetrics.malConfirmados / data.subsetMetrics.noConvergentes) * 100).toFixed(1) + "%",
            errorSilencioso: (data.metrics.errorSilencioso * 100).toFixed(1) + "%",
            revisionManual: (data.metrics.revisionManualRate * 100).toFixed(1) + "%",
            latenciaWarmup: formatMs(data.warmupLatencyMs),
            latenciaDesempateP50: formatMs(latSorted[Math.floor(latSorted.length * 0.5)] || 0),
            latenciaDesempateP95: formatMs(latSorted[Math.floor(latSorted.length * 0.95)] || 0),
            loadDurationP50: formatMs(loadSorted[Math.floor(loadSorted.length * 0.5)] || 0),
        };
    });
    console.table(tableAB);

    console.log("\n=== MÉTRICAS PIPELINE COMPLETO ===");
    const tablePipeline = Object.entries(perModel).map(([modelo, data]) => ({
        modelo,
        accuracy: (data.metrics.accuracy * 100).toFixed(1) + "%",
        errorSilencioso: (data.metrics.errorSilencioso * 100).toFixed(1) + "%",
        revisionManual: (data.metrics.revisionManualRate * 100).toFixed(1) + "%",
        recallOTRO: (data.metrics.recallOTRO * 100).toFixed(1) + "%",
        posibleAgresorPar: (data.metrics.posibleAgresorParRate * 100).toFixed(1) + "%",
        latenciaP50: formatMs(data.metrics.latencyP50Ms),
        latenciaP95: formatMs(data.metrics.latencyP95Ms),
    }));
    console.table(tablePipeline);

    // Recomendación
    const candidates = Object.entries(perModel)
        .filter(([, data]) => data.metrics.errorSilencioso <= P4_THRESHOLD)
        .sort((a, b) => {
            const aErr = a[1].metrics.errorSilencioso;
            const bErr = b[1].metrics.errorSilencioso;
            if (Math.abs(aErr - bErr) > 0.01) return aErr - bErr;
            const aMal = a[1].subsetMetrics.malConfirmados;
            const bMal = b[1].subsetMetrics.malConfirmados;
            if (aMal !== bMal) return aMal - bMal;
            return a[1].metrics.latencyP95Ms - b[1].metrics.latencyP95Ms;
        });

    let recommendation: string;
    let winner: string | null = null;
    if (candidates.length === 0) {
        recommendation = "Ningún modelo pasó P4. F6 queda deshabilitada (modelo_desempate vacío).";
    } else {
        winner = candidates[0][0];
        recommendation = `Ganador: ${winner} — menor error silencioso dentro del umbral P4, menor tasa de mal confirmados y/o mejor latencia.`;
    }

    console.log(`\n=== RECOMENDACIÓN ===`);
    console.log(recommendation);
    console.log(`Umbral P4: error_silencioso ≤ ${(P4_THRESHOLD * 100).toFixed(2)}%`);

    const report = {
        metadata: {
            modeloClasificacion: MODELO_CLASIFICACION,
            modeloEmbedding: MODELO_EMBEDDING,
            fixture: fixturePath,
            totalExamples: examples.length,
            timestamp: new Date().toISOString(),
        },
        p4Threshold: P4_THRESHOLD,
        perModel: Object.fromEntries(
            Object.entries(perModel).map(([modelo, data]) => [
                modelo,
                {
                    metrics: {
                        accuracy: Number(data.metrics.accuracy.toFixed(4)),
                        precisionAutoClasificados: Number(data.metrics.precisionAutoClasificados.toFixed(4)),
                        errorSilencioso: Number(data.metrics.errorSilencioso.toFixed(4)),
                        revisionManualRate: Number(data.metrics.revisionManualRate.toFixed(4)),
                        latencyP50Ms: data.metrics.latencyP50Ms,
                        latencyP95Ms: data.metrics.latencyP95Ms,
                        posibleAgresorParRate: Number(data.metrics.posibleAgresorParRate.toFixed(4)),
                        recallOTRO: Number(data.metrics.recallOTRO.toFixed(4)),
                    },
                    subsetMetrics: data.subsetMetrics,
                    warmupLatencyMs: data.warmupLatencyMs,
                    desempateLatencies: data.desempateLatencies,
                    desempateLoadDurations: data.desempateLoadDurations,
                    details: data.results,
                },
            ])
        ),
        recommendation,
        winner,
    };

    const outDir = path.join(process.cwd(), "eval-results");
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `f6-cascada-classifier-${Date.now()}.json`);
    await fs.writeFile(outFile, JSON.stringify(report, null, 2));

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
