#!/usr/bin/env node
/**
 * Worker periódico del detector de anomalías dinero-vs-valor (SPEC-225, 002-PI-126).
 *
 * En cada tick:
 *   (a) relee los umbrales `analisis.anomalias.*` de ParametroSistema (tuning
 *       sin redeploy, FR-004),
 *   (b) evalúa las 6 reglas deterministas sobre Suscripcion/Pago/SesionLog/
 *       Reporte (conteos) con semana calendario America/Bogota,
 *   (c) persiste las anomalías nuevas (dedup por anomalía abierta) y alerta al
 *       CEO vía Motor Notif las de severidad ALTA (fail-open).
 *
 * La cadencia (`analisis.anomalias.tick_min`, default 60 min) se relee en cada
 * ciclo. Instancia única vía advisory lock de PostgreSQL (id 123456795; los
 * ids en uso se documentan en AGENTS.md / prompt del mega-lote). Si el lock
 * está tomado, sale con código 2. SIGTERM/SIGINT: termina el tick en curso,
 * libera el lock y sale limpio.
 *
 * Arranque manual:
 *   TZ=America/Bogota node --env-file-if-exists=.env --import tsx scripts/worker-anomalias.mjs
 * Tick único (validación / quickstart):
 *   TZ=America/Bogota node --env-file-if-exists=.env --import tsx scripts/worker-anomalias.mjs --run-once
 */

import { ejecutarDeteccion } from "../src/lib/analisis/anomalias/detector.ts";
import { obtenerTickMinAnomalias } from "../src/lib/analisis/anomalias/parametros.ts";
import { iniciarTickVida } from "../src/lib/monitoreo/tick-vida.ts";
import pg from "pg";

iniciarTickVida("pi-anomalias"); // SPEC-291: healthcheck externo + monitor

const { Client } = pg;
const ADVISORY_LOCK_ID = 123456795;
const RUN_ONCE = process.argv.includes("--run-once");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[Anomalias] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

let lockClient = null;
let detenido = false;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[Anomalias] Lock de instancia ya está en uso; otro worker-anomalias está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[Anomalias] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[Anomalias] Advisory lock liberado.");
        } catch (err) {
            console.error("[Anomalias] Error liberando advisory lock:", err.message);
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
    console.log(`[Anomalias] Señal recibida (${signal}); terminando el tick en curso...`);
    detenido = true;
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/** Duerme en tramos cortos para que SIGTERM cierre pronto pese al tick largo. */
async function dormir(ms) {
    const TRAMO_MS = 5_000;
    let restante = ms;
    while (!detenido && restante > 0) {
        const tramo = Math.min(TRAMO_MS, restante);
        await new Promise((resolve) => setTimeout(resolve, tramo));
        restante -= tramo;
    }
}

async function main() {
    await acquireAdvisoryLock();

    if (RUN_ONCE) {
        await ejecutarDeteccion();
        await releaseAdvisoryLock();
        console.log("[Anomalias] Tick único completado (--run-once).");
        process.exit(0);
    }

    console.log("[Anomalias] Worker iniciado (cadencia: analisis.anomalias.tick_min, default 60 min).");
    while (!detenido) {
        try {
            await ejecutarDeteccion();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[Anomalias] Error en tick: ${msg}`);
        }
        if (detenido) break;
        let tickMin = 60;
        try {
            tickMin = await obtenerTickMinAnomalias();
        } catch (err) {
            console.error(`[Anomalias] No se pudo leer tick_min; se usa 60 — ${err instanceof Error ? err.message : err}`);
        }
        await dormir(Math.max(1, tickMin) * 60_000);
    }
    await releaseAdvisoryLock();
    console.log("[Anomalias] Worker detenido limpio.");
    process.exit(0);
}

main().catch((err) => {
    console.error("[Anomalias] Fatal:", err instanceof Error ? err.message : String(err));
    process.exit(1);
});
