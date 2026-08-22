#!/usr/bin/env node
/**
 * Worker pg-boss de cierre de sesiones por inactividad.
 * SPEC-206 (002-PI-120).
 *
 * Configuración dinámica desde ParametroSistema:
 * - sesion.timeout_inactividad_minutos (default 30)
 * - sesion.worker_intervalo_minutos (default 5)
 */

import pg from "pg";
import { boss, ensureStarted } from "../src/lib/queue.ts";
import { getParametroSistemaValor } from "../src/lib/parametros.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[WORKER-SESIONES] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const { Client } = pg;
const ADVISORY_LOCK_ID = 123456790;
let lockClient = null;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[WORKER-SESIONES] Lock de instancia ya está en uso; otro worker de sesiones está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[WORKER-SESIONES] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[WORKER-SESIONES] Advisory lock liberado.");
        } catch (err) {
            console.error("[WORKER-SESIONES] Error liberando advisory lock:", err.message);
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

async function ensureQueue(name) {
    await ensureStarted();
    try {
        await boss.createQueue(name);
        console.log(`[WORKER-SESIONES] Cola '${name}' creada`);
    } catch {
        console.log(`[WORKER-SESIONES] Cola '${name}' ya existe`);
    }
}

async function shutdown(signal) {
    console.log(`[WORKER-SESIONES] Señal de terminación recibida (${signal}); liberando lock...`);
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function start() {
    await acquireAdvisoryLock();
    await ensureQueue("sesion-cierre-inactividad");

    const timeoutMin = Number.parseInt((await getParametroSistemaValor("sesion.timeout_inactividad_minutos")) ?? "30", 10);
    const intervaloMin = Number.parseInt((await getParametroSistemaValor("sesion.worker_intervalo_minutos")) ?? "5", 10);
    const cron = Number.isFinite(intervaloMin) && intervaloMin >= 1 && intervaloMin <= 59
        ? `*/${intervaloMin} * * * *`
        : "*/5 * * * *";

    console.log(`[WORKER-SESIONES] Iniciado. timeout=${timeoutMin}min, intervalo=${intervaloMin}min, cron=${cron}`);

    await boss.schedule("sesion-cierre-inactividad", cron, {}, { tz: "America/Bogota" });
    await boss.work("sesion-cierre-inactividad", async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        const jobId = job?.id;
        console.log(`[WORKER-SESIONES] Procesando job ${jobId}`);
        try {
            const { SessionLogService } = await import("../src/lib/dal/services/session-log.ts");
            const cerradas = await new SessionLogService().cerrarPorInactividad(timeoutMin);
            console.log(`[WORKER-SESIONES] Cerradas ${cerradas} sesiones inactivas`);
            return { success: true, cerradas };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[WORKER-SESIONES] ERROR: ${msg}`);
            throw err;
        }
    });
}

start().catch((err) => {
    console.error("[WORKER-SESIONES] Error fatal:", err.message);
    process.exit(1);
});
