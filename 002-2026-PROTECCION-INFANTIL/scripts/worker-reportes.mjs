#!/usr/bin/env node
/**
 * Worker pg-boss para procesamiento de reportes
 * Supervisado por pm2: pm2 start scripts/worker-reportes.mjs --name "reportes-worker"
 */

import { PgBoss } from "pg-boss";

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
    console.log("[WORKER] Iniciado. Escuchando cola 'reporte-procesamiento'...");

    // Verificar Ollama al inicio
    const ollamaOk = await checkOllamaHealth();
    console.log(`[WORKER] Ollama health: ${ollamaOk ? "OK" : "NO RESPONDE (los jobs fallarán)"}`);

    await boss.work("reporte-procesamiento", async (job) => {
        const { reporteId } = job.data;
        const startMs = Date.now();

        console.log(`[WORKER] Procesando reporte ${reporteId} (job ${job.id})`);

        try {
            const res = await fetch(`${API_BASE_URL}/api/reportes/procesar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Worker-Secret": WORKER_SECRET,
                },
                body: JSON.stringify({ reporteId }),
            });

            const latencia = Date.now() - startMs;

            if (!res.ok) {
                const err = await res.text();
                console.error(`[WORKER] ERROR reporte=${reporteId} status=${res.status} latencia=${latencia}ms error=${err}`);
                throw new Error(`HTTP ${res.status}: ${err}`);
            }

            const data = await res.json();
            console.log(`[WORKER] OK reporte=${reporteId} estado=${data.estado} latencia=${latencia}ms`);
            return { success: true, estado: data.estado };
        } catch (err) {
            const latencia = Date.now() - startMs;
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[WORKER] ERROR reporte=${reporteId} latencia=${latencia}ms error=${msg}`);
            throw err;
        }
    });
}

start().catch((err) => {
    console.error("[WORKER] Fatal:", err.message);
    process.exit(1);
});