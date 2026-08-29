#!/usr/bin/env node
/**
 * SPEC-234 (002-PI-134): worker de refresco de la caché de señal comunitaria.
 *
 * - Advisory lock propio en PostgreSQL (una sola instancia activa).
 * - Poll de filas inválidas/vencidas de `SenalComunitariaCache`.
 * - Recálculo SQL puro; sin llamadas a API ni IA.
 *
 * Uso:
 *   node --import tsx scripts/worker-senal-comunitaria.mjs
 */

import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";
import { workerLogger } from "../src/lib/monitoreo/worker-logger.ts";
import { getParametroSistemaValor } from "../src/lib/parametros.ts";
import { refrescarSenalComunitariaPendientes } from "../src/lib/expediente/senal-comunitaria/refrescar-pendientes.ts";
import { iniciarTickVida } from "../src/lib/monitoreo/tick-vida.ts";

iniciarTickVida("pi-senal-comunitaria"); // SPEC-291: healthcheck externo + monitor

const { Client } = pg;
// SPEC-284 (I-130): ID único y sin separadores JS para que sea greppeable.
// Antes 123_456_790 colisionaba con monitor-probes (mismo número, formato distinto);
// tres semanas de PRs no lo detectaron por el `_`. Fuente de verdad: scripts/ADVISORY-LOCKS.md.
const ADVISORY_LOCK_ID = 123456796;
const DEFAULT_REFRESH_MIN = 60;
const DEFAULT_LIMITE = 100;
const MIN_INTERVALO_SEG = 10;
const MAX_INTERVALO_SEG = 300;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[SENAL] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const logger = workerLogger.child({ servicio: "pi-senal-comunitaria" });
let lockClient = null;
let shuttingDown = false;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[SENAL] Lock de instancia ya está en uso; otro worker está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[SENAL] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[SENAL] Advisory lock liberado.");
        } catch (err) {
            console.error("[SENAL] Error liberando advisory lock:", err instanceof Error ? err.message : err);
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

async function getRefreshMin() {
    const raw = await getParametroSistemaValor("padre.senal_comunitaria.refresh_min");
    const parsed = Number.parseInt(raw ?? String(DEFAULT_REFRESH_MIN), 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_REFRESH_MIN;
}

function calcularIntervaloSeg(refreshMin) {
    const deseado = refreshMin * 60;
    return Math.max(MIN_INTERVALO_SEG, Math.min(deseado, MAX_INTERVALO_SEG));
}

async function ciclo() {
    while (!shuttingDown) {
        try {
            const refreshMin = await getRefreshMin();
            const intervaloSeg = calcularIntervaloSeg(refreshMin);

            const procesados = await refrescarSenalComunitariaPendientes(refreshMin, DEFAULT_LIMITE);
            if (procesados > 0) {
                await logger.info("Caché de señal comunitaria refrescada", { refreshMin, procesados });
            }

            await sleep(intervaloSeg * 1000);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[SENAL] ERROR en ciclo de refresco:", msg);
            await logger.error("Error en ciclo de refresco", { error: msg });
            await sleep(60_000);
        }
    }
}

async function shutdown(signal) {
    shuttingDown = true;
    await logger.warn("Worker cerrándose por señal", { signal });
    console.log(`[SENAL] Señal de terminación ${signal} recibida; liberando lock...`);
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function start() {
    await acquireAdvisoryLock();
    await logger.info("Worker de señal comunitaria iniciado", { pid: process.pid });
    console.log("[SENAL] Worker iniciado.");
    await ciclo();
}

start().catch(async (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SENAL] Fatal:", msg);
    await logger.error("Fatal", { error: msg });
    await releaseAdvisoryLock();
    process.exit(1);
});
