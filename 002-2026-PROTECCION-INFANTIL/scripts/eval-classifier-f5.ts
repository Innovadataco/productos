#!/usr/bin/env tsx
/**
 * Eval harness F5 — RAG sobre correcciones.
 *
 * A/B obligatorio:
 *   - Brazo A: RAG + votos (F4)
 *   - Brazo B: RAG + llamada única (F3-revert)
 *
 * Sobre el brazo A se corre el sweep offline de políticas (0.5/0.6/0.8/1.0/margen).
 * Persiste votos por caso para poder recalcular sin llamadas extra.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/eval-classifier-f5.ts [fixture.json]
 */
import { prisma } from "@/lib/prisma";
import { clasificarConVotos, clasificarReporte, type VotoIndividual } from "@/lib/ai/classifier";
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
    secundarias: Categoria[];
    secundariaCorrecta: boolean;
    votos?: VotoIndividual[];
    guardaDoxing: boolean;
    guardaDoxingVerdadera: boolean;
    ejemplosRecuperados: { texto: string; categoria: string; similitud: number }[];
}

interface RunMetrics {
    accuracy: number;
    precisionAutoClasificados: number;
    errorSilencioso: number;
    revisionManualRate: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    posibleAgresorParRate: number;
    secondaryRecall: number;
    recallOTRO: number;
}

const BASELINE_ERROR_SILENCIOSO_F3 = 0.2632;
const MODELO_EMBEDDING = "nomic-embed-text";
const MODELO_CLASIFICACION = "ornith:9b";

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
        secondaryRecall,
        recallOTRO: otroRecall,
    };
}

function applyPolicy(result: ResultArm, policyName: string): ResultArm {
    if (!result.votos || result.votos.length === 0) return result;
    const n = result.votos.length;
    const counts = new Map<string, number>();
    for (const v of result.votos) {
        counts.set(v.categoria, (counts.get(v.categoria) ?? 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const topCat = sorted[0]?.[0] ?? "OTRO";
    const topCount = sorted[0]?.[1] ?? 0;
    const secondCount = sorted[1]?.[1] ?? 0;
    const conf = topCount / n;

    let estado = "REVISION_MANUAL";
    if (policyName === "umbral_0.5" && conf >= 0.5) estado = "CLASIFICADO";
    if (policyName === "umbral_0.6" && conf >= 0.6) estado = "CLASIFICADO";
    if (policyName === "umbral_0.8" && conf >= 0.8) estado = "CLASIFICADO";
    if (policyName === "umbral_1.0" && conf >= 1.0) estado = "CLASIFICADO";
    if (policyName === "margen_2" && topCount - secondCount >= 2) estado = "CLASIFICADO";

    const correct = topCat === result.expected;
    return {
        ...result,
        predicted: topCat as Categoria,
        confidence: conf,
        estado,
        correct,
    };
}

function sweepPolicies(results: ResultArm[]): Record<string, RunMetrics> {
    const policies = ["umbral_0.5", "umbral_0.6", "umbral_0.8", "umbral_1.0", "margen_2"];
    const out: Record<string, RunMetrics> = {};
    for (const p of policies) {
        const recalc = results.map((r) => applyPolicy(r, p));
        out[p] = computeMetrics(recalc);
    }
    return out;
}

async function ensureSeedF5() {
    // Se asume que scripts/seed-f5-dataset.ts ya fue ejecutado.
    // Este helper solo verifica que haya al menos 1 ejemplo por frontera crítica.
    const needed: Categoria[] = ["DIFUSION_NO_CONSENTIDA", "SOLICITUD_MATERIAL", "CONTACTO_INSISTENTE"];
    for (const cat of needed) {
        const count = await prisma.datasetEntrenamiento.count({
            where: { clasificacionCorrecta: cat, fuente: "siembra" },
        });
        if (count === 0) {
            console.warn(`[F5] No se encontraron ejemplos siembra para ${cat}. Ejecutá primero scripts/seed-f5-dataset.ts`);
        }
    }
}

async function runAntiLeakageTest() {
    const texto = "test anti-leakage exacto del fixture de evaluación f5";
    const vector = await generarEmbedding(MODELO_EMBEDDING, texto);

    const datasetRegistro = await prisma.datasetEntrenamiento.create({
        data: {
            texto,
            clasificacionCorrecta: "OTRO",
            fuente: "test_eval",
        },
    });
    const vectorStr = "[" + vector.join(",") + "]";
    await prisma.$executeRaw`
        INSERT INTO "EmbeddingDataset" (id, "datasetId", vector, "modeloUsado", "creadoEn")
        VALUES (${crypto.randomUUID()}, ${datasetRegistro.id}, ${vectorStr}::vector, ${MODELO_EMBEDDING}, NOW())
    `;

    const recuperados = await buscarEjemplosSimilares(vector, { topK: 3, excluirSimilitudMayorA: 0.98 });
    const filtrado = recuperados.filter((r) => r.datasetId === datasetRegistro.id);

    await prisma.$executeRaw`DELETE FROM "EmbeddingDataset" WHERE "datasetId" = ${datasetRegistro.id}`;
    await prisma.datasetEntrenamiento.delete({ where: { id: datasetRegistro.id } });

    if (filtrado.length > 0) {
        throw new Error("Anti-leakage falló: se recuperó el gemelo exacto del caso evaluado");
    }
    console.log("[F5] Anti-leakage OK: gemelo exacto (>0.98) fue excluido.");
}

async function classifyArm(
    examples: Example[],
    armName: "votos" | "unica"
): Promise<ResultArm[]> {
    const results: ResultArm[] = [];

    for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        process.stdout.write(`[${armName}] [${i + 1}/${examples.length}] `);
        const start = Date.now();
        try {
            const vector = await generarEmbedding(MODELO_EMBEDDING, ex.text);
            const ejemplos = await buscarEjemplosSimilares(vector, { topK: 3, excluirSimilitudMayorA: 0.98 });

            let res;
            if (armName === "votos") {
                res = await clasificarConVotos(MODELO_CLASIFICACION, ex.text, {
                    nVotos: 5,
                    temperatura: 0.7,
                    seeds: [42, 123, 456, 789, 1024],
                    minScoreCategoria: 0.3,
                    umbralRevision: 0.8,
                    ollamaNumParallel: 2,
                    ejemplos,
                });
            } else {
                res = await clasificarReporte(MODELO_CLASIFICACION, ex.text, 0.5, { temperature: 0, seed: 42 }, ejemplos);
            }
            const latencyMs = Date.now() - start;
            const correct = res.categoria === ex.expected;

            const doxing = detectarDoxing(ex.text);
            const guardaDoxing = doxing.esDoxing && res.categoria !== "DOXING";
            const guardaDoxingVerdadera = guardaDoxing && ex.expected === "DOXING";

            const secundarias = res.categoriasSecundarias.map((s) => s.categoria as Categoria);
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
                secundarias,
                secundariaCorrecta,
                votos: armName === "votos" ? res.votos : undefined,
                guardaDoxing,
                guardaDoxingVerdadera,
                ejemplosRecuperados: ejemplos,
            });
            const agresorParTag = res.posibleAgresorPar ? " [PAR]" : "";
            console.log(`${correct ? "OK" : "FAIL"}${agresorParTag} | ${ex.expected} -> ${res.categoria} (${res.estado}) ${latencyMs}ms | ej=${ejemplos.length}`);
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
                secundarias: [],
                secundariaCorrecta: false,
                votos: [],
                guardaDoxing: false,
                guardaDoxingVerdadera: false,
                ejemplosRecuperados: [],
            });
            console.log(`ERROR | ${ex.expected} -> ${err instanceof Error ? err.message : String(err)}`);
        }
        await sleep(500);
    }

    return results;
}

function reportEffectOnUnanimous(
    resultsA: ResultArm[],
    resultsB: ResultArm[],
    unanimeTexts: Set<string>
) {
    const aUnanimes = resultsA.filter((r) => unanimeTexts.has(r.text));
    const bUnanimes = resultsB.filter((r) => unanimeTexts.has(r.text));

    const aFlipped = aUnanimes.filter((r) => r.correct);
    const bFlipped = bUnanimes.filter((r) => r.correct);

    console.log(`\n=== EFECTO SOBRE LOS 17 CASOS UNÁNIMES ERRÓNEOS DE F4 ===`);
    console.log(`RAG+votos volteó: ${aFlipped.length}/${aUnanimes.length}`);
    console.log(`RAG+llamada-única volteó: ${bFlipped.length}/${bUnanimes.length}`);

    if (aFlipped.length > 0) {
        console.log("\nCasos volteados por RAG+votos:");
        for (const r of aFlipped) {
            console.log(`- ${r.expected} -> ${r.predicted}: "${r.text.slice(0, 80)}..."`);
        }
    }
    if (bFlipped.length > 0) {
        console.log("\nCasos volteados por RAG+llamada-única:");
        for (const r of bFlipped) {
            console.log(`- ${r.expected} -> ${r.predicted}: "${r.text.slice(0, 80)}..."`);
        }
    }

    return { aFlipped: aFlipped.length, bFlipped: bFlipped.length };
}

function formatPolicyTable(sweep: Record<string, RunMetrics>, armName: string) {
    return Object.entries(sweep).map(([policy, m]) => ({
        arm: armName,
        policy,
        accuracy: (m.accuracy * 100).toFixed(1) + "%",
        error_silencioso: (m.errorSilencioso * 100).toFixed(1) + "%",
        revision_manual: (m.revisionManualRate * 100).toFixed(1) + "%",
        recall_otro: (m.recallOTRO * 100).toFixed(1) + "%",
    }));
}

async function main() {
    const fixturePath = process.argv[2] || "scripts/eval-fixture.json";
    const raw = await fs.readFile(fixturePath, "utf-8");
    const fixture = JSON.parse(raw);
    const examples: Example[] = fixture.examples;

    console.log(`Evaluando ${examples.length} ejemplos contra F5 (RAG) — 2 brazos...\n`);

    await ensureSeedF5();
    await runAntiLeakageTest();

    // Cargar los textos de los 17 casos unánimes erróneos de F4 desde el reporte F4 más reciente
    const evalResultsDir = path.join(process.cwd(), "eval-results");
    const f4Reports = (await fs.readdir(evalResultsDir))
        .filter((f) => f.startsWith("f4-votacion-classifier-"))
        .sort()
        .reverse();
    let unanimeTexts = new Set<string>();
    if (f4Reports.length > 0) {
        const f4ReportPath = path.join(evalResultsDir, f4Reports[0]);
        const f4Report = JSON.parse(await fs.readFile(f4ReportPath, "utf-8"));
        const f4Details: { text: string; expected: string; predicted: string; votos?: { categoria: string }[] }[] = f4Report.details || [];
        for (const d of f4Details) {
            if (!d.votos || d.votos.length === 0) continue;
            const allSame = d.votos.every((v) => v.categoria === d.votos![0].categoria);
            if (allSame && d.votos[0].categoria !== d.expected) {
                unanimeTexts.add(d.text);
            }
        }
    } else {
        console.warn("[F5] No se encontró reporte F4 previo; no se podrá reportar efecto sobre los 17 casos unánimes erróneos.");
    }
    console.log(`[F5] Casos unánimes erróneos de F4 cargados: ${unanimeTexts.size}`);

    const resultsA = await classifyArm(examples, "votos");
    const resultsB = await classifyArm(examples, "unica");

    const metricsA = computeMetrics(resultsA);
    const metricsB = computeMetrics(resultsB);
    const sweepA = sweepPolicies(resultsA);

    console.log("\n=== MÉTRICAS BASE ===");
    console.log("RAG + votos (umbral 0.8):");
    console.table({
        accuracy: (metricsA.accuracy * 100).toFixed(1) + "%",
        error_silencioso: (metricsA.errorSilencioso * 100).toFixed(1) + "%",
        revision_manual: (metricsA.revisionManualRate * 100).toFixed(1) + "%",
        recall_otro: (metricsA.recallOTRO * 100).toFixed(1) + "%",
        recall_secundarias: (metricsA.secondaryRecall * 100).toFixed(1) + "%",
        latencia_p50: metricsA.latencyP50Ms + "ms",
        latencia_p95: metricsA.latencyP95Ms + "ms",
    });

    console.log("\nRAG + llamada única (umbral 0.5):");
    console.table({
        accuracy: (metricsB.accuracy * 100).toFixed(1) + "%",
        error_silencioso: (metricsB.errorSilencioso * 100).toFixed(1) + "%",
        revision_manual: (metricsB.revisionManualRate * 100).toFixed(1) + "%",
        recall_otro: (metricsB.recallOTRO * 100).toFixed(1) + "%",
        recall_secundarias: (metricsB.secondaryRecall * 100).toFixed(1) + "%",
        latencia_p50: metricsB.latencyP50Ms + "ms",
        latencia_p95: metricsB.latencyP95Ms + "ms",
    });

    console.log("\n=== SWEEP POLÍTICAS — RAG+VOTOS ===");
    console.table(formatPolicyTable(sweepA, "votos"));

    reportEffectOnUnanimous(resultsA, resultsB, unanimeTexts);

    const bestPolicyA = Object.entries(sweepA).reduce((best, [policy, m]) =>
        m.errorSilencioso < best.errorSilencioso ? { policy, ...m } : best
    , { policy: "none", errorSilencioso: 1, revisionManualRate: 1, accuracy: 0, recallOTRO: 0 } as { policy: string } & RunMetrics);

    const winner =
        metricsB.errorSilencioso < bestPolicyA.errorSilencioso
            ? { arm: "llamada-unica", errorSilencioso: metricsB.errorSilencioso, revisionManualRate: metricsB.revisionManualRate }
            : { arm: "votos", policy: bestPolicyA.policy, errorSilencioso: bestPolicyA.errorSilencioso, revisionManualRate: bestPolicyA.revisionManualRate };

    console.log(`\n=== GANADOR A/B ===`);
    console.log(winner);

    const report = {
        metadata: {
            modeloClasificacion: MODELO_CLASIFICACION,
            modeloEmbedding: MODELO_EMBEDDING,
            fixture: fixturePath,
            totalExamples: examples.length,
            timestamp: new Date().toISOString(),
        },
        antiLeakage: { passed: true },
        base: {
            votos: metricsA,
            llamadaUnica: metricsB,
        },
        sweepVotos: sweepA,
        effectOnUnanimous: reportEffectOnUnanimous(resultsA, resultsB, unanimeTexts),
        winner,
        detailsA: resultsA,
        detailsB: resultsB,
    };

    const outDir = path.join(process.cwd(), "eval-results");
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `f5-rag-classifier-${Date.now()}.json`);
    await fs.writeFile(outFile, JSON.stringify(report, null, 2));
    console.log(`\nReporte guardado en: ${outFile}`);

    const bestError = Math.min(bestPolicyA.errorSilencioso, metricsB.errorSilencioso);
    if (bestError > BASELINE_ERROR_SILENCIOSO_F3) {
        console.error(
            `\nFRENAR — mejor error_silencioso (${(bestError * 100).toFixed(1)}%) no cruza la línea F3-revert (${(BASELINE_ERROR_SILENCIOSO_F3 * 100).toFixed(2)}%)`
        );
        process.exit(1);
    }

    console.log(`\nF5 RECUPERADO — error_silencioso ${(bestError * 100).toFixed(1)}% ≤ ${(BASELINE_ERROR_SILENCIOSO_F3 * 100).toFixed(2)}%`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
