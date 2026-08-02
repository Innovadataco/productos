import { prisma } from "@/lib/prisma";
import { descifrarValorParametro } from "@/lib/parametros";
import { aJson } from "../dal/json";
import type { Prisma } from "@prisma/client";
import { clasificarConMotorActivo, motorActivo, type MotorClasificacion } from "./motor";
import { generarEmbedding } from "./embedder";
import { buscarEjemplosSimilares } from "./dataset-retrieval";
import { decidirGuardasSeguridad } from "./guardas-decision";
import { MODELO_CLASIFICACION_DEFAULT, MODELO_EMBEDDING_DEFAULT } from "./defaults";
import { getOllamaBaseUrl } from "./ollama-config";
import fs from "fs/promises";
import path from "path";
import { logger } from "@/lib/logger";

export const CATEGORIAS_EVAL = [
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
] as const;

export type CategoriaEval = (typeof CATEGORIAS_EVAL)[number];

export interface EvalExample {
    id?: string | undefined;
    text: string;
    expected: CategoriaEval;
    ruido: boolean;
    secundariaEsperada?: CategoriaEval | undefined;
}

export interface EvalResultArm {
    id?: string | undefined;
    text: string;
    expected: CategoriaEval;
    predicted: CategoriaEval;
    confidence: number;
    estado: string;
    latencyMs: number;
    correct: boolean;
    ruido: boolean;
    fallback: boolean;
    posibleAgresorPar: boolean;
    guardaDoxing: boolean;
    guardaDoxingVerdadera: boolean;
    guardaKeywords: boolean;
    keywordsDetectadas: string[];
    prioridadAlta: boolean;
}

export interface RunMetrics {
    accuracy: number;
    precisionAutoClasificados: number;
    errorSilencioso: number;
    revisionManualRate: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    posibleAgresorParRate: number;
    recallOTRO: number;
}

export interface PerCategoryMetrics {
    precision: number;
    recall: number;
    f1: number;
    support: number;
}

export interface OperationalMetrics {
    duracionTotalMs: number;
    casosPorMinuto: number;
    tasaFallbacks: number;
    activacionesGuardas: number;
    doxingVerdaderas: number;
    keywordsActivadas: number;
    prioridadAltaTotal: number;
}

export interface ExperimentConfigSnapshot {
    modeloClasificacion: string;
    modeloEmbedding: string;
    umbralRevision: number;
    nVotos: number;
    temperaturaVotos: number;
    ragTopK: number;
    ollamaBaseUrl: string;
    fixtureVersion: number;
    /** SPEC-138 (E-7): motor de la corrida (lectura tolerante: históricos sin el campo = legacy). */
    motorUsado?: MotorClasificacion | undefined;
}

export interface F7Report {
    metadata: {
        modeloClasificacion: string;
        modeloEmbedding: string;
        /** SPEC-138 (E-7): motor de la corrida (ausente en históricos = legacy). */
        motorUsado?: MotorClasificacion | undefined;
        fixture?: string | undefined;
        fixtureVersion: number;
        totalExamples: number;
        timestamp: string;
        duracionTotalMs: number;
    };
    metrics: RunMetrics;
    segmented: { limpio: RunMetrics; ruidoso: RunMetrics };
    perCategory: Record<string, PerCategoryMetrics>;
    operational: OperationalMetrics;
    guardas: {
        activacionesGuardas: number;
        doxingVerdaderas: number;
        keywordsActivadas: number;
        prioridadAltaTotal: number;
    };
    details: EvalResultArm[];
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

export function computeMetrics(results: EvalResultArm[]): RunMetrics {
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

export function segmentMetrics(results: EvalResultArm[]) {
    const limpio = results.filter((r) => !r.ruido);
    const ruidoso = results.filter((r) => r.ruido);
    return {
        limpio: computeMetrics(limpio),
        ruidoso: computeMetrics(ruidoso),
    };
}

export function computePerCategoryMetrics(results: EvalResultArm[]): Record<string, PerCategoryMetrics> {
    const metrics: Record<string, PerCategoryMetrics> = {};
    for (const cat of CATEGORIAS_EVAL) {
        const tp = results.filter((r) => r.predicted === cat && r.expected === cat).length;
        const fp = results.filter((r) => r.predicted === cat && r.expected !== cat).length;
        const fn = results.filter((r) => r.expected === cat && r.predicted !== cat).length;
        const support = results.filter((r) => r.expected === cat).length;
        const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
        const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
        const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
        metrics[cat] = { precision, recall, f1, support };
    }
    return metrics;
}

export function computeOperationalMetrics(results: EvalResultArm[], duracionTotalMs: number): OperationalMetrics {
    const total = results.length;
    const minutos = duracionTotalMs / 60000;
    return {
        duracionTotalMs,
        casosPorMinuto: minutos === 0 ? 0 : total / minutos,
        tasaFallbacks: total === 0 ? 0 : results.filter((r) => r.fallback).length / total,
        activacionesGuardas: results.filter((r) => r.guardaDoxing || r.guardaKeywords).length,
        doxingVerdaderas: results.filter((r) => r.guardaDoxingVerdadera).length,
        keywordsActivadas: results.filter((r) => r.guardaKeywords).length,
        prioridadAltaTotal: results.filter((r) => r.prioridadAlta).length,
    };
}

export async function getCurrentProductionConfig(): Promise<ExperimentConfigSnapshot> {
    const params = await prisma.parametroSistema.findMany({
        where: {
            clave: {
                in: [
                    "reportes.classification_model",
                    "reportes.embedding_model",
                    "reportes.classification.umbral_revision",
                    "reportes.classification.n_votos",
                    "reportes.classification.temperatura_votos",
                    "reportes.classification.rag_top_k",
                    "system.ollama_base_url",
                ],
            },
        },
    });

    const decryptedParams = params.map(descifrarValorParametro);

    const get = (clave: string, fallback: string) => decryptedParams.find((p) => p.clave === clave)?.valor || fallback;
    const getNum = (clave: string, fallback: number) => {
        const v = params.find((p) => p.clave === clave)?.valor;
        return v ? Number(v) : fallback;
    };

    const fixtureVersion = await prisma.casoEval.aggregate({ _max: { fixtureVersion: true } }).then((r) => r._max.fixtureVersion ?? 1);

    return {
        modeloClasificacion: get("reportes.classification_model", MODELO_CLASIFICACION_DEFAULT),
        modeloEmbedding: get("reportes.embedding_model", MODELO_EMBEDDING_DEFAULT),
        umbralRevision: getNum("reportes.classification.umbral_revision", 1.0),
        nVotos: getNum("reportes.classification.n_votos", 5),
        temperaturaVotos: getNum("reportes.classification.temperatura_votos", 0.7),
        ragTopK: getNum("reportes.classification.rag_top_k", 3),
        ollamaBaseUrl: await getOllamaBaseUrl(),
        fixtureVersion,
    };
}

export async function loadActiveEvalCases(): Promise<{ examples: EvalExample[]; fixtureVersion: number }> {
    const [rows, versionAgg] = await prisma.$transaction([
        prisma.casoEval.findMany({ where: { activo: true }, orderBy: { creadoEn: "asc" } }),
        prisma.casoEval.aggregate({ _max: { fixtureVersion: true } }),
    ]);
    const examples: EvalExample[] = rows.map((r) => ({
        id: r.id,
        text: r.texto,
        expected: r.categoriaEsperada as CategoriaEval,
        ruido: r.ruido,
        secundariaEsperada: (r.secundariaEsperada as CategoriaEval) || undefined,
    }));
    return { examples, fixtureVersion: versionAgg._max.fixtureVersion ?? 1 };
}

export async function runF7Eval(
    examples: EvalExample[],
    opts: {
        config?: Partial<ExperimentConfigSnapshot>;
        onProgress?: (done: number, total: number) => void;
    } = {}
): Promise<EvalResultArm[]> {
    const config: ExperimentConfigSnapshot = {
        modeloClasificacion: opts.config?.modeloClasificacion || MODELO_CLASIFICACION_DEFAULT,
        modeloEmbedding: opts.config?.modeloEmbedding || MODELO_EMBEDDING_DEFAULT,
        umbralRevision: opts.config?.umbralRevision ?? 1.0,
        nVotos: opts.config?.nVotos ?? 5,
        temperaturaVotos: opts.config?.temperaturaVotos ?? 0.7,
        ragTopK: opts.config?.ragTopK ?? 3,
        ollamaBaseUrl: opts.config?.ollamaBaseUrl || "",
        fixtureVersion: opts.config?.fixtureVersion ?? 1,
        // SPEC-138 (E-7): la corrida registra el motor que la ejercitó (selector unificado).
        motorUsado: opts.config?.motorUsado ?? (await motorActivo()),
    };

    const results: EvalResultArm[] = [];

    // Misma clave y default que producción (api/reportes/procesar/helpers/parametros.ts)
    const paramUmbralSpam = await prisma.parametroSistema.findUnique({ where: { clave: "clasificacion.umbral_spam" } });
    const umbralSpam = parseFloat(paramUmbralSpam?.valor || "0.7");

    for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        process.stdout.write(`[F7] [${i + 1}/${examples.length}] `);
        opts.onProgress?.(i, examples.length);
        const start = Date.now();
        try {
            const vector = await generarEmbedding(config.modeloEmbedding, ex.text);
            const ejemplos = await buscarEjemplosSimilares(vector, {
                topK: config.ragTopK,
                excluirSimilitudMayorA: 0.98,
            });

            const res = await clasificarConMotorActivo(ex.text, {
                modeloClasificacionLegacy: config.modeloClasificacion,
                voting: {
                    nVotos: config.nVotos,
                    temperatura: config.temperaturaVotos,
                    seeds: [42, 123, 456, 789, 1024],
                    minScoreCategoria: 0.3,
                    umbralRevision: config.umbralRevision,
                    ollamaNumParallel: 2,
                    ejemplos,
                },
            });
            const latencyMs = Date.now() - start;
            let predicted = res.categoria as CategoriaEval;
            let estado = res.estado;
            let correct = predicted === ex.expected;

            // Guardas determinísticas: misma decisión que producción (spec 123).
            // esRafaga=false: la eval procesa casos aislados, sin ráfaga.
            const decision = decidirGuardasSeguridad({
                texto: ex.text,
                clasificacion: { categoria: res.categoria, confianza: res.confianza },
                estadoInicial: res.estado,
                esRafaga: false,
                umbralSpam,
            });
            estado = decision.estadoFinal;
            const prioridadAlta = decision.prioridadAlta;
            const keywordsDetectadas = decision.keywordsDetectadas;
            const guardaDoxing = decision.reglasAplicadas.includes("doxing_no_reflejado_por_modelo");
            const guardaDoxingVerdadera = guardaDoxing && ex.expected === "DOXING";
            const guardaKeywords = decision.reglasAplicadas.includes("keywords_riesgo");

            results.push({
                id: ex.id,
                text: ex.text,
                expected: ex.expected,
                predicted,
                confidence: res.confianza,
                estado,
                latencyMs,
                correct,
                ruido: ex.ruido,
                fallback: res.fallback,
                posibleAgresorPar: res.posibleAgresorPar,
                guardaDoxing,
                guardaDoxingVerdadera,
                guardaKeywords,
                keywordsDetectadas,
                prioridadAlta,
            });
            const tags = [res.posibleAgresorPar ? "PAR" : "", guardaDoxing ? "DOXING" : "", guardaKeywords ? "KEYWORDS" : ""]
                .filter(Boolean)
                .map((t) => `[${t}]`)
                .join(" ");
            logger.info(`${correct ? "OK" : "FAIL"}${tags ? ` ${tags}` : ""} | ${ex.expected} -> ${predicted} (${estado}) ${latencyMs}ms | ej=${ejemplos.length}`);
        } catch (err) {
            const latencyMs = Date.now() - start;
            results.push({
                id: ex.id,
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
                guardaDoxing: false,
                guardaDoxingVerdadera: false,
                guardaKeywords: false,
                keywordsDetectadas: [],
                prioridadAlta: false,
            });
            logger.info(`ERROR | ${ex.expected} -> ${err instanceof Error ? err.message : String(err)}`);
        }
        await sleep(500);
    }
    opts.onProgress?.(examples.length, examples.length);

    return results;
}

export function buildF7Report(
    results: EvalResultArm[],
    fixtureVersion: number,
    opts: {
        modeloClasificacion?: string;
        modeloEmbedding?: string;
        fixture?: string;
        duracionTotalMs?: number;
        /** SPEC-138 (E-7): motor que ejercitó la corrida (selector unificado). */
        motorUsado?: MotorClasificacion | undefined;
    } = {}
): F7Report {
    const metrics = computeMetrics(results);
    const segmented = segmentMetrics(results);
    const perCategory = computePerCategoryMetrics(results);
    const duracionTotalMs = opts.duracionTotalMs ?? results.reduce((sum, r) => sum + r.latencyMs, 0);
    const operational = computeOperationalMetrics(results, duracionTotalMs);

    return {
        metadata: {
            modeloClasificacion: opts.modeloClasificacion || MODELO_CLASIFICACION_DEFAULT,
            modeloEmbedding: opts.modeloEmbedding || MODELO_EMBEDDING_DEFAULT,
            motorUsado: opts.motorUsado,
            fixture: opts.fixture,
            fixtureVersion,
            totalExamples: results.length,
            timestamp: new Date().toISOString(),
            duracionTotalMs,
        },
        metrics,
        segmented,
        perCategory,
        operational,
        guardas: {
            activacionesGuardas: operational.activacionesGuardas,
            doxingVerdaderas: operational.doxingVerdaderas,
            keywordsActivadas: operational.keywordsActivadas,
            prioridadAltaTotal: operational.prioridadAltaTotal,
        },
        details: results,
    };
}

export async function saveEvalReportToFile(report: F7Report): Promise<string> {
    const outDir = path.join(process.cwd(), "eval-results");
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `f7-guardas-classifier-${Date.now()}.json`);
    await fs.writeFile(outFile, JSON.stringify(report, null, 2));
    return outFile;
}

export async function persistEvalRun(
    runId: string,
    report: F7Report,
    opts: { resultados?: Array<{ casoEvalId: string; result: EvalResultArm }> } = {}
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await tx.evalRun.update({
            where: { id: runId },
            data: {
                estado: "COMPLETADA",
                finalizadoEn: new Date(),
                resultadoJson: aJson(report),
                fixtureVersion: report.metadata.fixtureVersion,
                progresoCasos: report.metadata.totalExamples,
                progresoTotal: report.metadata.totalExamples,
            },
        });

        if (opts.resultados && opts.resultados.length > 0) {
            await tx.evalResultado.createMany({
                data: opts.resultados.map((r) => ({
                    experimentoId: runId,
                    casoEvalId: r.casoEvalId,
                    esperado: r.result.expected,
                    predicho: r.result.predicted,
                    confianza: r.result.confidence,
                    estadoFinal: r.result.estado,
                    correcto: r.result.correct,
                    latenciaMs: r.result.latencyMs,
                })),
            });
        }
    });
}

export async function markEvalRunFailed(runId: string, error: string): Promise<void> {
    await prisma.evalRun.update({
        where: { id: runId },
        data: { estado: "FALLIDA", finalizadoEn: new Date(), error },
    });
}

export async function updateEvalRunProgress(runId: string, done: number, total: number): Promise<void> {
    await prisma.evalRun.update({
        where: { id: runId },
        data: { progresoCasos: done, progresoTotal: total, estado: "EN_PROGRESO" },
    });
}
