#!/usr/bin/env node
/**
 * Worker pg-boss para procesamiento de reportes
 * Supervisado por pm2: pm2 start scripts/worker-reportes.mjs --name "reportes-worker"
 *
 * Configuración de reintentos (pg-boss DLQ):
 * - retryLimit: 3 (máximo 3 reintentos después del intento inicial)
 * - retryDelay: 30 segundos base
 * - retryBackoff: true (exponencial: 30s, 60s, 120s)
 * - Los jobs que agotan reintentos quedan en estado 'failed' en pgboss.job (DLQ nativa)
 *
 * Resiliencia adicional:
 * - Healthcheck de Ollama antes de cada job.
 * - Retry manual con backoff exponencial para errores transitorios (5xx/red).
 */

import { PgBoss } from "pg-boss";
import { fetchWithRetry } from "../src/lib/fetch-retry.ts";

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

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5005";
const MAX_RETRY = 3;
const BASE_DELAY_MS = 1000;

const boss = new PgBoss(DATABASE_URL);

boss.on("error", (error) => {
    console.error("[WORKER] pg-boss error:", error.message);
});

async function checkOllamaHealth() {
    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
        return res.ok;
    } catch {
        return false;
    }
}

async function start() {
    await boss.start();
    try {
        await boss.createQueue("reporte-procesamiento");
        console.log("[WORKER] Cola creada");
    } catch {
        console.log("[WORKER] Cola ya existe");
    }
    console.log("[WORKER] Iniciado. Escuchando cola 'reporte-procesamiento'...");
    console.log(`[WORKER] Config: retryLimit=${MAX_RETRY}, retryDelay=30s, backoff=exponencial`);

    // Verificar Ollama al inicio
    const ollamaOk = await checkOllamaHealth();
    console.log(`[WORKER] Ollama health: ${ollamaOk ? "OK" : "NO RESPONDE (los jobs fallarán)"}`);

    await boss.work("reporte-procesamiento", async (jobs) => {
        // pg-boss v12 puede pasar un array de jobs
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        if (!job || !job.data) {
            console.error("[WORKER] Job inválido:", JSON.stringify(jobs));
            return;
        }
        const reporteId = job.data.reporteId;
        const startMs = Date.now();
        const retryCount = job.retryCount || 0;

        console.log(`[WORKER] Procesando reporte ${reporteId} (job ${job.id}, intento ${retryCount + 1}/${MAX_RETRY + 1})`);

        // Healthcheck Ollama antes de procesar
        const ollamaHealthy = await checkOllamaHealth();
        if (!ollamaHealthy) {
            console.error(`[WORKER] ERROR reporte=${reporteId} Ollama no disponible, reintentando más tarde`);
            throw new Error("Ollama no disponible");
        }

        try {
            const res = await fetchWithRetry(`${API_BASE_URL}/api/reportes/procesar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Worker-Secret": WORKER_SECRET,
                },
                body: JSON.stringify({ reporteId }),
                maxRetries: MAX_RETRY,
                baseDelayMs: BASE_DELAY_MS,
            });

            const latencia = Date.now() - startMs;

            if (!res.ok) {
                console.error(`[WORKER] ERROR reporte=${reporteId} status=${res.status} latencia=${latencia}ms intento=${retryCount + 1} error=<redactado>`);
                throw new Error(`HTTP ${res.status}: worker processing failed`);
            }

            const data = await res.json();
            console.log(`[WORKER] OK reporte=${reporteId} estado=${data.estado} latencia=${latencia}ms`);
            return { success: true, estado: data.estado };
        } catch (err) {
            const latencia = Date.now() - startMs;
            const msg = err instanceof Error ? err.message : "Error desconocido";
            const esUltimoIntento = retryCount >= MAX_RETRY;
            console.error(
                `[WORKER] ERROR reporte=${reporteId} latencia=${latencia}ms intento=${retryCount + 1} ultimoIntento=${esUltimoIntento} error=<redactado>`
            );
            if (esUltimoIntento) {
                console.error(`[WORKER] DLQ reporte=${reporteId} motivo=${msg}`);
            }
            throw err;
        }
    });
}

start().catch((err) => {
    console.error("[WORKER] Fatal:", err.message);
    process.exit(1);
});
