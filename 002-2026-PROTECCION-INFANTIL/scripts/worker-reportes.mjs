#!/usr/bin/env node
/**
 * Worker pg-boss para procesamiento de reportes
 * Supervisado por pm2: pm2 start scripts/worker-reportes.mjs --name "reportes-worker"
 *
 * Configuración dinámica desde ParametroSistema:
 * - worker.max_reintentos
 * - worker.retry_delay_segundos
 * - worker.concurrencia
 * - worker.max_pendientes
 *
 * Resiliencia:
 * - Healthcheck de Ollama antes de cada job.
 * - Reintentos manejados por pg-boss con backoff exponencial.
 * - Historial de intentos en ReintentoReporte.
 * - Fallback a REVISION_MANUAL cuando se agotan reintentos.
 */

import { fetchWithRetry } from "../src/lib/fetch-retry.ts";
import { procesarBackfillAnonimizacion } from "../src/lib/ai/dataset-anonimizacion-backfill.ts";
import { procesarBackfillEmbedding } from "../src/lib/ai/dataset-embedding-backfill.ts";
import { getOllamaBaseUrl } from "../src/lib/ai/ollama-config.ts";
import { prisma } from "../src/lib/prisma.ts";
import { logAudit } from "../src/lib/audit.ts";
import { notificarCambioCirculoSiCorresponde } from "../src/lib/circulo-confianza.ts";
import { notificarColegioSiCorresponde } from "../src/lib/colegio/alertas.ts";
import { boss, getWorkerParams, drainPending, ensureStarted } from "../src/lib/queue.ts";
import { guardarReintento } from "../src/lib/reporte-reintentos.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[WORKER] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const WORKER_SECRET = process.env.WORKER_SECRET;
if (!WORKER_SECRET) {
    console.error("[WORKER] ERROR: WORKER_SECRET no configurada");
    process.exit(1);
}

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5005";
const MAX_FETCH_RETRY = 3;
const BASE_DELAY_MS = 1000;

boss.on("error", (error) => {
    console.error("[WORKER] pg-boss error:", error.message);
});

async function checkOllamaHealth() {
    try {
        const ollamaBaseUrl = await getOllamaBaseUrl();
        const res = await fetch(`${ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
        return res.ok;
    } catch {
        return false;
    }
}

async function ensureQueue(name) {
    try {
        await boss.createQueue(name);
        console.log(`[WORKER] Cola '${name}' creada`);
    } catch {
        console.log(`[WORKER] Cola '${name}' ya existe`);
    }
}

async function llamarFallback(reporteId, error) {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/reportes/fallback`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Worker-Secret": WORKER_SECRET,
        },
        body: JSON.stringify({ reporteId, error }),
        maxRetries: MAX_FETCH_RETRY,
        baseDelayMs: BASE_DELAY_MS,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Fallback HTTP ${res.status}: ${text}`);
    }
    return res.json();
}

import pg from "pg";

const { Client } = pg;
const ADVISORY_LOCK_ID = 123456789;
let lockClient = null;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[WORKER] Lock de instancia ya está en uso; otro worker está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[WORKER] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[WORKER] Advisory lock liberado.");
        } catch (err) {
            console.error("[WORKER] Error liberando advisory lock:", err.message);
        } finally {
            try {
                await lockClient.end();
            } catch {
                // ignore
            }
            lockClient = null;
        }
    }
}

async function shutdown() {
    console.log("[WORKER] Señal de terminación recibida; liberando lock...");
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function start() {
    await acquireAdvisoryLock();
    await ensureStarted();
    await ensureQueue("reporte-procesamiento");
    await ensureQueue("dataset-anonimizacion-backfill");
    await ensureQueue("dataset-embedding-backfill");
    await ensureQueue("eval-classifier-run");
    await ensureQueue("simulacion-run");

    const { maxReintentos, retryDelaySegundos, concurrencia } = await getWorkerParams();

    console.log("[WORKER] Iniciado. Escuchando colas 'reporte-procesamiento', 'dataset-anonimizacion-backfill', 'dataset-embedding-backfill', 'eval-classifier-run' y 'simulacion-run'...");
    console.log(`[WORKER] Config: max_reintentos=${maxReintentos}, retry_delay=${retryDelaySegundos}s, concurrencia=${concurrencia}, backoff=exponencial`);

    const ollamaOk = await checkOllamaHealth();
    console.log(`[WORKER] Ollama health: ${ollamaOk ? "OK" : "NO RESPONDE (los jobs fallarán)"}`);

    await boss.work(
        "reporte-procesamiento",
        { teamSize: concurrencia, teamConcurrency: concurrencia, batchSize: 1 },
        async (jobs) => {
            const job = Array.isArray(jobs) ? jobs[0] : jobs;
            if (!job || !job.data) {
                console.error("[WORKER] Job inválido:", JSON.stringify(jobs));
                return;
            }
            const reporteId = job.data.reporteId;
            const startMs = Date.now();
            const retryCount = job.retryCount || 0;
            const retryLimit = typeof job.retryLimit === "number" ? job.retryLimit : maxReintentos;
            const intento = retryCount + 1;
            const esUltimoIntento = retryCount >= retryLimit;

            console.log(`[WORKER] Procesando reporte ${reporteId} (job ${job.id}, intento ${intento}/${retryLimit + 1})`);

            await guardarReintento({ reporteId, intento, exitoso: false, error: undefined });

            const ollamaHealthy = await checkOllamaHealth();
            if (!ollamaHealthy) {
                const msg = "Ollama no disponible";
                console.error(`[WORKER] ERROR reporte=${reporteId} ${msg}`);
                await guardarReintento({ reporteId, intento, exitoso: false, error: msg });
                if (esUltimoIntento) {
                    await llamarFallback(reporteId, msg);
                }
                throw new Error(msg);
            }

            try {
                const res = await fetchWithRetry(`${API_BASE_URL}/api/reportes/procesar`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Worker-Secret": WORKER_SECRET,
                    },
                    body: JSON.stringify({ reporteId, modeloClasificacion: job.data.modeloClasificacion }),
                    maxRetries: MAX_FETCH_RETRY,
                    baseDelayMs: BASE_DELAY_MS,
                });

                const latencia = Date.now() - startMs;

                if (!res.ok) {
                    const body = await res.text();
                    const msg = `HTTP ${res.status}: worker processing failed`;
                    console.error(`[WORKER] ERROR reporte=${reporteId} status=${res.status} latencia=${latencia}ms intento=${intento} error=${body}`);
                    await guardarReintento({ reporteId, intento, exitoso: false, error: msg });
                    if (esUltimoIntento) {
                        await llamarFallback(reporteId, msg);
                    }
                    throw new Error(msg);
                }

                const data = await res.json();
                console.log(`[WORKER] OK reporte=${reporteId} estado=${data.estado} latencia=${latencia}ms`);

                await guardarReintento({ reporteId, intento, exitoso: true, error: undefined });

                notificarCambioCirculoSiCorresponde(reporteId).catch((err) => {
                    console.error(`[WORKER] Error notificando círculo reporte=${reporteId}:`, err.message);
                });

                notificarColegioSiCorresponde(reporteId).catch((err) => {
                    console.error(`[WORKER] Error notificando colegio reporte=${reporteId}:`, err.message);
                });

                // Drenar reportes pendientes cuando baja la carga
                drainPending().catch((err) => {
                    console.error(`[WORKER] Error drenando pendientes:`, err.message);
                });

                return { success: true, estado: data.estado };
            } catch (err) {
                const latencia = Date.now() - startMs;
                const msg = err instanceof Error ? err.message : "Error desconocido";
                console.error(
                    `[WORKER] ERROR reporte=${reporteId} latencia=${latencia}ms intento=${intento} ultimoIntento=${esUltimoIntento} error=${msg}`
                );
                await guardarReintento({ reporteId, intento, exitoso: false, error: msg });
                if (esUltimoIntento) {
                    try {
                        await llamarFallback(reporteId, msg);
                    } catch (fallbackErr) {
                        console.error(`[WORKER] ERROR fallback reporte=${reporteId}:`, fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
                    }
                }
                throw err;
            }
        }
    );

    await boss.work("dataset-anonimizacion-backfill", async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        if (!job || !job.data) {
            console.error("[WORKER] Job inválido:", JSON.stringify(jobs));
            return;
        }
        const datasetId = job.data.datasetId;
        const retryCount = job.retryCount || 0;

        console.log(`[WORKER] Backfill anonimización dataset ${datasetId} (job ${job.id}, intento ${retryCount + 1})`);

        const ollamaHealthy = await checkOllamaHealth();
        if (!ollamaHealthy) {
            console.error(`[WORKER] ERROR dataset=${datasetId} Ollama no disponible, reintentando más tarde`);
            throw new Error("Ollama no disponible");
        }

        try {
            await procesarBackfillAnonimizacion(datasetId);
            console.log(`[WORKER] OK dataset=${datasetId} anonimizado`);
            return { success: true };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[WORKER] ERROR dataset=${datasetId} intento=${retryCount + 1} error=${msg}`);
            throw err;
        }
    });

    await boss.work("dataset-embedding-backfill", async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        if (!job || !job.data) {
            console.error("[WORKER] Job inválido:", JSON.stringify(jobs));
            return;
        }
        const datasetId = job.data.datasetId;
        const retryCount = job.retryCount || 0;

        console.log(`[WORKER] Backfill embedding dataset ${datasetId} (job ${job.id}, intento ${retryCount + 1})`);

        const ollamaHealthy = await checkOllamaHealth();
        if (!ollamaHealthy) {
            console.error(`[WORKER] ERROR dataset=${datasetId} Ollama no disponible, reintentando más tarde`);
            throw new Error("Ollama no disponible");
        }

        try {
            await procesarBackfillEmbedding(datasetId);
            console.log(`[WORKER] OK dataset=${datasetId} embedding generado`);
            return { success: true };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[WORKER] ERROR dataset=${datasetId} intento=${retryCount + 1} error=${msg}`);
            throw err;
        }
    });

    await boss.work("eval-classifier-run", async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        if (!job || !job.data) {
            console.error("[WORKER] Job inválido:", JSON.stringify(jobs));
            return;
        }
        const { runId } = job.data;
        console.log(`[WORKER] Iniciando eval run ${runId} (job ${job.id})`);

        const {
            loadActiveEvalCases,
            runF7Eval,
            buildF7Report,
            persistEvalRun,
            saveEvalReportToFile,
            markEvalRunFailed,
            updateEvalRunProgress,
        } = await import("../src/lib/ai/eval-runner.ts");

        try {
            const run = await prisma.evalRun.update({ where: { id: runId }, data: { estado: "EN_PROGRESO" } });

            const ollamaHealthy = await checkOllamaHealth();
            if (!ollamaHealthy) {
                throw new Error("Ollama no disponible");
            }

            const snapshot = run.configSnapshot || {};
            const modeloClasificacion = snapshot.modeloClasificacion || "ornith:9b";
            const ollamaBaseUrl = await getOllamaBaseUrl();
            const tagsRes = await fetch(`${ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(10000) });
            if (tagsRes.ok) {
                const tagsData = await tagsRes.json();
                const installed = (tagsData.models || []).map((m) => m.name || m.model);
                if (!installed.includes(modeloClasificacion)) {
                    throw new Error(`El modelo ${modeloClasificacion} no está instalado en Ollama`);
                }
            }

            const { examples, fixtureVersion } = await loadActiveEvalCases();
            const start = Date.now();
            const results = await runF7Eval(examples, {
                config: {
                    modeloClasificacion,
                    modeloEmbedding: snapshot.modeloEmbedding || "nomic-embed-text",
                    umbralRevision: snapshot.umbralRevision ?? 1.0,
                    nVotos: snapshot.nVotos ?? 5,
                    temperaturaVotos: snapshot.temperaturaVotos ?? 0.7,
                    ragTopK: snapshot.ragTopK ?? 3,
                    ollamaBaseUrl,
                    fixtureVersion,
                },
                onProgress: (done, total) => updateEvalRunProgress(runId, done, total),
            });
            const duracionTotalMs = Date.now() - start;

            const report = buildF7Report(results, fixtureVersion, {
                modeloClasificacion,
                modeloEmbedding: snapshot.modeloEmbedding || "nomic-embed-text",
                duracionTotalMs,
            });

            const resultados = examples
                .map((ex, i) => (ex.id && results[i] ? { casoEvalId: ex.id, result: results[i] } : null))
                .filter(Boolean);

            await persistEvalRun(runId, report, { resultados });
            const outFile = await saveEvalReportToFile(report);

            await logAudit({
                accion: "EXPERIMENT_COMPLETE",
                tipoRecurso: "EvalRun",
                recursoId: runId,
                usuarioId: run.creadoPorId ?? undefined,
                valorNuevo: JSON.stringify({
                    nombre: run.nombre,
                    fixtureVersion,
                    metrics: report.metrics,
                    operational: report.operational,
                }),
                ipAddress: "worker",
                userAgent: "worker",
            });

            console.log(`[WORKER] OK eval run=${runId} fixtureVersion=${fixtureVersion} reporte=${outFile}`);
            return { success: true, runId };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[WORKER] ERROR eval run=${runId} error=${msg}`);
            try {
                await markEvalRunFailed(runId, msg);
            } catch (markErr) {
                console.error(`[WORKER] ERROR no se pudo marcar eval run=${runId} como fallido:`, markErr);
            }
            throw err;
        }
    });

    await boss.work("simulacion-run", async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        if (!job || !job.data) {
            console.error("[WORKER] Job inválido:", JSON.stringify(jobs));
            return;
        }
        const { runId, modeloClasificacion } = job.data;
        console.log(`[WORKER] Iniciando simulación run ${runId} modelo ${modeloClasificacion} (job ${job.id})`);
        try {
            const { runSimulacionBatchCreator } = await import("../src/lib/simulacion/executor.ts");
            await runSimulacionBatchCreator(runId, modeloClasificacion);
            console.log(`[WORKER] OK simulacion-run=${runId}`);
            return { success: true, runId };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[WORKER] ERROR simulacion-run=${runId} error=${msg}`);
            try {
                await prisma.simulacionRun.update({
                    where: { id: runId },
                    data: { estado: "FALLIDA", fechaFin: new Date() },
                });
            } catch (markErr) {
                console.error(`[WORKER] ERROR no se pudo marcar simulacion-run=${runId} como fallida:`, markErr);
            }
            throw err;
        }
    });

    // I-06: lote multi-modelo. Ejecuta runs en SECUENCIA: crea/encola los
    // reportes del run y espera su cierre (COMPLETADA/FALLIDA/CANCELADA lo
    // determina el ciclo de completitud) antes de pasar al siguiente.
    await boss.work("simulacion-lote", async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        if (!job || !job.data || !Array.isArray(job.data.runIds)) {
            console.error("[WORKER] Job de lote inválido:", JSON.stringify(jobs));
            return;
        }
        const { runIds } = job.data;
        console.log(`[WORKER] Iniciando lote de simulación: ${runIds.length} run(s) (job ${job.id})`);

        const { runSimulacionBatchCreator } = await import("../src/lib/simulacion/executor.ts");
        const { actualizarProgresoYEstado } = await import("../src/lib/simulacion/progreso.ts");

        const paramTimeout = await prisma.parametroSistema.findUnique({
            where: { clave: "ia.simulacion_timeout_minutos" },
        });
        const timeoutMin = Number(paramTimeout?.valor) > 0 ? Number(paramTimeout.valor) : 60;
        const esperaMaxMs = timeoutMin * 60_000 + 10 * 60_000; // timeout del run + margen
        const POLL_MS = 10_000;

        const ESTADOS_FINALES_RUN = ["COMPLETADA", "FALLIDA", "CANCELADA"];

        for (const runId of runIds) {
            let run = await prisma.simulacionRun.findUnique({ where: { id: runId } });
            if (!run) {
                console.error(`[WORKER] Lote: run ${runId} no encontrado; se salta.`);
                continue;
            }
            if (ESTADOS_FINALES_RUN.includes(run.estado)) {
                console.log(`[WORKER] Lote: run ${runId} ya está ${run.estado}; se salta.`);
                continue;
            }

            try {
                if (run.estado === "PENDIENTE") {
                    console.log(`[WORKER] Lote: creando reportes de run ${runId} modelo ${run.modelo}`);
                    await runSimulacionBatchCreator(runId, run.modelo);
                }

                // Esperar completitud (poll de estado; el cierre lo fija el hook de progreso)
                const inicio = Date.now();
                for (;;) {
                    await new Promise((r) => setTimeout(r, POLL_MS));
                    const { estado } = await actualizarProgresoYEstado(runId);
                    if (ESTADOS_FINALES_RUN.includes(estado)) {
                        console.log(`[WORKER] Lote: run ${runId} terminó con estado ${estado}.`);
                        break;
                    }
                    if (Date.now() - inicio > esperaMaxMs) {
                        console.error(`[WORKER] Lote: run ${runId} excedió la espera máxima; se marca FALLIDA y se continúa.`);
                        await prisma.simulacionRun.update({
                            where: { id: runId },
                            data: { estado: "FALLIDA", fechaFin: new Date() },
                        });
                        break;
                    }
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error desconocido";
                console.error(`[WORKER] Lote: error en run ${runId}: ${msg}; se continúa con el siguiente.`);
                try {
                    await prisma.simulacionRun.update({
                        where: { id: runId },
                        data: { estado: "FALLIDA", fechaFin: new Date() },
                    });
                } catch (markErr) {
                    console.error(`[WORKER] Lote: no se pudo marcar run ${runId} como fallido:`, markErr);
                }
            }
        }

        console.log(`[WORKER] OK lote de simulación (${runIds.length} run(s))`);
        return { success: true, runIds };
    });
}

start().catch((err) => {
    console.error("[WORKER] Fatal:", err.message);
    process.exit(1);
});
