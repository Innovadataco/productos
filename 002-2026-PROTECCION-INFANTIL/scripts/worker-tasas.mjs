#!/usr/bin/env node
/**
 * Worker pg-boss para refresco programado de tasas de cambio (SPEC-214).
 * Programado cada 24h a las 06:00 America/Bogota.
 * Usa advisory lock propio para garantizar una sola instancia activa.
 */

import { actualizarTasasDesdeAPI } from "../src/lib/pagos/tasas.ts";
import { boss, ensureStarted } from "../src/lib/queue.ts";
import { getParametroSistemaValor } from "../src/lib/parametros.ts";
import pg from "pg";

const { Client } = pg;
const ADVISORY_LOCK_ID = 123456790;
const DEFAULT_CRON = "0 6 * * *";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[WORKER-TASAS] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

let lockClient = null;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[WORKER-TASAS] Lock de instancia ya está en uso; otro worker de tasas está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[WORKER-TASAS] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[WORKER-TASAS] Advisory lock liberado.");
        } catch (err) {
            console.error("[WORKER-TASAS] Error liberando advisory lock:", err.message);
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

async function shutdown(signal) {
    console.log(`[WORKER-TASAS] Señal de terminación recibida (${signal}); liberando lock...`);
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function getCron() {
    const horas = await getParametroSistemaValor("pagos.tasas.refresco_horas");
    const h = parseInt(horas ?? "24", 10);
    if (Number.isFinite(h) && h >= 1 && h <= 24) {
        return `0 */${h} * * *`;
    }
    return DEFAULT_CRON;
}

async function start() {
    await acquireAdvisoryLock();
    await ensureStarted();

    const cron = await getCron();
    console.log(`[WORKER-TASAS] Programando refresco con cron: ${cron}`);
    await boss.schedule("tasas-refresh", cron, {}, { tz: "America/Bogota" });

    await boss.work("tasas-refresh", async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        console.log(`[WORKER-TASAS] Procesando job ${job?.id}`);
        try {
            const resultado = await actualizarTasasDesdeAPI();
            console.log(`[WORKER-TASAS] Completado: ${resultado.insertadas} tasas insertadas`);
            if (resultado.errores.length > 0) {
                console.warn("[WORKER-TASAS] Errores parciales:", resultado.errores.join("; "));
            }
            return { success: resultado.ok, ...resultado };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[WORKER-TASAS] Error refrescando tasas: ${msg}`);
            throw err;
        }
    });
}

start().catch((err) => {
    console.error("[WORKER-TASAS] Fatal:", err.message);
    process.exit(1);
});
