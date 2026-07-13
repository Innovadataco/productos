#!/usr/bin/env node
/**
 * Worker pg-boss para procesamiento de reportes
 * Supervisado por pm2: pm2 start scripts/worker-reportes.mjs --name "reportes-worker"
 */

import PgBoss from "pg-boss";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[WORKER] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const boss = new PgBoss(DATABASE_URL);

boss.on("error", (error) => {
    console.error("[WORKER] pg-boss error:", error.message);
});

async function start() {
    await boss.start();
    console.log("[WORKER] Iniciado. Escuchando cola 'reporte-procesamiento'...");

    await boss.work("reporte-procesamiento", async (job) => {
        const { reporteId } = job.data;
        console.log(`[WORKER] Procesando reporte ${reporteId} (job ${job.id})`);

        // TODO: Implementar clasificación IA + embeddings (Fase 4)
        // 1. Leer reporte de BD
        // 2. Llamar a Ollama (ornith:9b) para clasificación + detección PII
        // 3. Generar embedding (nomic-embed-text)
        // 4. Actualizar estado del reporte
        // 5. Actualizar IdentificadorReportado

        console.log(`[WORKER] Reporte ${reporteId} procesado (TODO: implementar)`);
        return { success: true };
    });
}

start().catch((err) => {
    console.error("[WORKER] Fatal:", err.message);
    process.exit(1);
});