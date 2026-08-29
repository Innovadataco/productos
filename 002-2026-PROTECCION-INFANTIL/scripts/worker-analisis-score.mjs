#!/usr/bin/env node
/**
 * Worker pg-boss del score de valor de cliente (SPEC-220, 002-PI-121).
 * Programado con cron derivado de `analisis.score.frecuencia_recalculo_horas`
 * (default: diario 03:30 America/Bogota). Cada corrida ejecuta:
 *   (a) recálculo del período actual (mes calendario Bogotá)
 *   (b) purga de retención de snapshots (analisis.score.retencion_meses)
 * Usa advisory lock propio (123456791) para garantizar una sola instancia.
 */

import { recalcularScoresPeriodo, purgarSnapshotsAntiguos } from "../src/lib/analisis/score.ts";
import { boss, ensureStarted, ensureQueue } from "../src/lib/queue.ts";
import { getParametroSistemaValor } from "../src/lib/parametros.ts";
import pg from "pg";
import { iniciarTickVida } from "../src/lib/monitoreo/tick-vida.ts";

iniciarTickVida("pi-analisis-score"); // SPEC-291: healthcheck externo + monitor

const { Client } = pg;
const ADVISORY_LOCK_ID = 123456791;
const DEFAULT_CRON = "30 3 * * *";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[ANALISIS-SCORE] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

let lockClient = null;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[ANALISIS-SCORE] Lock de instancia ya está en uso; otro worker de análisis está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[ANALISIS-SCORE] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[ANALISIS-SCORE] Advisory lock liberado.");
        } catch (err) {
            console.error("[ANALISIS-SCORE] Error liberando advisory lock:", err.message);
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
    console.log(`[ANALISIS-SCORE] Señal de terminación recibida (${signal}); liberando lock...`);
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function getCron() {
    const horas = await getParametroSistemaValor("analisis.score.frecuencia_recalculo_horas");
    const h = parseInt(horas ?? "24", 10);
    if (Number.isFinite(h) && h >= 1 && h <= 23) {
        return `0 */${h} * * *`;
    }
    return DEFAULT_CRON;
}

async function start() {
    await acquireAdvisoryLock();
    await ensureStarted();

    // AMP I-131 (002-PI-180): crear la cola antes de agendar/consumirla.
    // Sin esto el worker se caía en bucle contra una BD recién creada
    // (D-003 §4: todo worker con cola propia crea su cola antes de usarla).
    await ensureQueue("analisis-score-recalculo");

    const cron = await getCron();
    console.log(`[ANALISIS-SCORE] Programando recálculo con cron: ${cron} (tz America/Bogota)`);
    await boss.schedule("analisis-score-recalculo", cron, {}, { tz: "America/Bogota" });

    await boss.work("analisis-score-recalculo", async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        console.log(`[ANALISIS-SCORE] Procesando job ${job?.id}`);
        try {
            const recalculo = await recalcularScoresPeriodo();
            const purga = await purgarSnapshotsAntiguos();
            console.log(
                `[ANALISIS-SCORE] Completado: ${recalculo.suscripcionesProcesadas} suscripciones recalculadas (periodo=${recalculo.periodo}); purga=${purga.filasEliminadas} filas`
            );
            return { success: true, recalculo, purga };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[ANALISIS-SCORE] Error en corrida: ${msg}`);
            throw err;
        }
    });
}

start().catch((err) => {
    console.error("[ANALISIS-SCORE] Fatal:", err.message);
    process.exit(1);
});
