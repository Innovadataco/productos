#!/usr/bin/env node
/**
 * SPEC-236 (002-PI-mega-cola): worker del motor de expediente padre.
 *
 * - Advisory lock propio en PostgreSQL (una sola instancia activa; la segunda
 *   sale con código 2, patrón del repo).
 * - Tick configurable vía `padre.expediente.motor.tick_min` (default 15 min).
 * - Tareas por tick: auto-cierre por inactividad, vigilancia de SLA del
 *   comité y purga de retención. El recálculo de gravedad corre cada 24h.
 * - Zona horaria del negocio: America/Bogota (TZ del proceso + date-fns-tz).
 *
 * Uso:
 *   TZ=America/Bogota node --import tsx scripts/worker-expediente-motor.mjs
 *   node --import tsx scripts/worker-expediente-motor.mjs --run-once
 */

process.env.TZ = process.env.TZ || "America/Bogota";

import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";
import { workerLogger } from "../src/lib/monitoreo/worker-logger.ts";
import { getParametroSistemaValor } from "../src/lib/parametros.ts";
import {
    cerrarExpedientesInactivos,
    vigilarSlaComite,
    recalcularGravedad24h,
    purgarRetenidos,
} from "../src/lib/expediente/motor/tareas-motor.ts";

const { Client } = pg;
// SPEC-236: lock propio del motor de expediente. En uso por otras specs del
// mega-lote: 123456789/790 (existentes), 123456791 (SPEC-220), 123456792 (SPEC-213).
const ADVISORY_LOCK_ID = 123456793;
const DEFAULT_TICK_MIN = 15;
const MIN_TICK_SEG = 10;
const INTERVALO_RECALCULO_GRAVEDAD_MS = 24 * 60 * 60 * 1000;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[EXPEDIENTE-MOTOR] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const logger = workerLogger.child({ servicio: "pi-expediente-motor" });
const RUN_ONCE = process.argv.includes("--run-once");
let lockClient = null;
let shuttingDown = false;
let ultimoRecalculoGravedad = 0;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[EXPEDIENTE-MOTOR] Lock de instancia ya está en uso; otro worker está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[EXPEDIENTE-MOTOR] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[EXPEDIENTE-MOTOR] Advisory lock liberado.");
        } catch (err) {
            console.error("[EXPEDIENTE-MOTOR] Error liberando advisory lock:", err instanceof Error ? err.message : err);
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

async function getTickMin() {
    const raw = await getParametroSistemaValor("padre.expediente.motor.tick_min");
    const parsed = Number.parseInt(raw ?? String(DEFAULT_TICK_MIN), 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_TICK_MIN;
}

async function ejecutarTick() {
    const ahora = new Date();

    const cerrados = await cerrarExpedientesInactivos(ahora);
    const slaVencidos = await vigilarSlaComite(ahora);
    const purgados = await purgarRetenidos(ahora);

    let subidosARojo = 0;
    if (ahora.getTime() - ultimoRecalculoGravedad >= INTERVALO_RECALCULO_GRAVEDAD_MS) {
        subidosARojo = await recalcularGravedad24h(ahora);
        ultimoRecalculoGravedad = ahora.getTime();
    }

    if (cerrados > 0 || slaVencidos > 0 || purgados > 0 || subidosARojo > 0) {
        await logger.info("Tick del motor de expediente", { cerrados, slaVencidos, purgados, subidosARojo });
    }
    console.log(
        `[EXPEDIENTE-MOTOR] Tick: cerrados=${cerrados} slaVencidos=${slaVencidos} purgados=${purgados} subidosARojo=${subidosARojo}`
    );
}

async function ciclo() {
    while (!shuttingDown) {
        try {
            await ejecutarTick();
            if (RUN_ONCE) return;
            const tickMin = await getTickMin();
            const intervaloSeg = Math.max(MIN_TICK_SEG, tickMin * 60);
            await sleep(intervaloSeg * 1000);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[EXPEDIENTE-MOTOR] ERROR en tick:", msg);
            await logger.error("Error en tick del motor de expediente", { error: msg });
            if (RUN_ONCE) {
                process.exitCode = 1;
                return;
            }
            await sleep(60_000);
        }
    }
}

async function shutdown(signal) {
    shuttingDown = true;
    await logger.warn("Worker cerrándose por señal", { signal });
    console.log(`[EXPEDIENTE-MOTOR] Señal de terminación ${signal} recibida; liberando lock...`);
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function start() {
    await acquireAdvisoryLock();
    await logger.info("Worker del motor de expediente iniciado", { pid: process.pid, tz: process.env.TZ });
    console.log(`[EXPEDIENTE-MOTOR] Worker iniciado (TZ=${process.env.TZ}).`);
    await ciclo();
    await releaseAdvisoryLock();
}

start().catch(async (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[EXPEDIENTE-MOTOR] Fatal:", msg);
    await logger.error("Fatal", { error: msg });
    await releaseAdvisoryLock();
    process.exit(1);
});
