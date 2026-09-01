#!/usr/bin/env node
/**
 * SPEC-341 (A-68 §4.4 capa 2 · T019) — worker del análisis IA del expediente.
 *
 * Consume la cola `padre.analisis.expediente` de a UNO (concurrency=1 por defecto,
 * parámetro `padre.analisis.max_concurrentes`). Cada job llama al ejecutor y
 * termina — sin reintentos automáticos (R-2). Advisory-lock propio garantiza
 * una sola instancia por Postgres (patrón del repo).
 */

import { boss, ensureStarted, ensureQueue } from "../src/lib/queue.ts";
import { ejecutarAnalisisJob } from "../src/lib/expediente/analisis/ejecutar-analisis.ts";
import { getParametroSistemaValor } from "../src/lib/parametros.ts";
import pg from "pg";
import { iniciarTickVida } from "../src/lib/monitoreo/tick-vida.ts";

iniciarTickVida("pi-analisis-expediente"); // SPEC-291: healthcheck externo

const { Client } = pg;
// SPEC-341: lock propio del worker de análisis del expediente.
// Ver scripts/ADVISORY-LOCKS.md · fila registrada al mismo PR (regla 2).
const ADVISORY_LOCK_ID = 123456799;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[ANALISIS-EXPEDIENTE] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

let lockClient = null;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[ANALISIS-EXPEDIENTE] Lock ya está en uso; otro worker activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[ANALISIS-EXPEDIENTE] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[ANALISIS-EXPEDIENTE] Advisory lock liberado.");
        } catch (err) {
            console.error("[ANALISIS-EXPEDIENTE] Error liberando advisory lock:", err.message);
        } finally {
            try { await lockClient.end(); } catch { /* ignore */ }
            lockClient = null;
        }
    }
}

async function shutdown(signal) {
    console.log(`[ANALISIS-EXPEDIENTE] Señal ${signal}; liberando lock...`);
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function start() {
    await acquireAdvisoryLock();
    await ensureStarted();
    await ensureQueue("padre.analisis.expediente");

    const maxConcRaw = await getParametroSistemaValor("padre.analisis.max_concurrentes");
    const maxConcurrentes = Number.parseInt(maxConcRaw ?? "1", 10) || 1;
    console.log(`[ANALISIS-EXPEDIENTE] Consumidor listo · concurrency=${maxConcurrentes}`);

    await boss.work(
        "padre.analisis.expediente",
        { batchSize: 1, teamSize: maxConcurrentes, teamConcurrency: 1 },
        async (jobs) => {
            for (const job of jobs) {
                const payload = job.data ?? {};
                console.log(`[ANALISIS-EXPEDIENTE] job=${job.id} exp=${payload.expedienteId} disparador=${payload.disparador}`);
                try {
                    await ejecutarAnalisisJob({
                        expedienteId: payload.expedienteId,
                        hashCadena: payload.hashCadena,
                        alcance: payload.alcance,
                    });
                } catch (err) {
                    // El ejecutor NO lanza (persiste FALLIDO). Si por algo llega
                    // acá, lo tragamos para no perder el job en pg-boss.
                    console.error(`[ANALISIS-EXPEDIENTE] Excepción inesperada en job=${job.id}: ${err?.message ?? err}`);
                }
            }
        }
    );
}

start().catch(async (err) => {
    console.error("[ANALISIS-EXPEDIENTE] Fatal:", err);
    await releaseAdvisoryLock();
    process.exit(1);
});
