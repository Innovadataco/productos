#!/usr/bin/env node
/**
 * Worker periódico del motor de reglas de recomendación (SPEC-221, 002-PI-122).
 *
 * Tick corto (30 s) que en cada ciclo:
 *   (a) relee los parámetros `analisis.recomendaciones.*` (dentro del motor),
 *   (b) evalúa las reglas activas cuya cadencia efectiva ya venció
 *       (max(frecuenciaMin, analisis.recomendaciones.frecuencia_evaluacion_min)),
 *   (c) expira recomendaciones PENDIENTE con expiraEn vencido (idempotente).
 *
 * Instancia única vía advisory lock de PostgreSQL (id 123456794; los ids en
 * uso se documentan en AGENTS.md / prompt del mega-lote). Si el lock está
 * tomado, sale con código 2. SIGTERM/SIGINT: termina el tick en curso, libera
 * el lock y sale limpio.
 *
 * Arranque manual:
 *   node --env-file-if-exists=.env --import tsx scripts/worker-analisis-reglas.mjs
 */

import {
    evaluarReglasPendientes,
    expirarRecomendacionesVencidas,
} from "../src/lib/analisis/reglas/motor.ts";
import pg from "pg";

const { Client } = pg;
const ADVISORY_LOCK_ID = 123456794;
const TICK_MS = Number(process.env.ANALISIS_REGLAS_TICK_MS) > 0
    ? Number(process.env.ANALISIS_REGLAS_TICK_MS)
    : 30_000;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[Analisis/Reglas] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

let lockClient = null;
let detenido = false;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[Analisis/Reglas] Lock de instancia ya está en uso; otro worker-analisis-reglas está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[Analisis/Reglas] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[Analisis/Reglas] Advisory lock liberado.");
        } catch (err) {
            console.error("[Analisis/Reglas] Error liberando advisory lock:", err.message);
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
    console.log(`[Analisis/Reglas] Señal recibida (${signal}); terminando el tick en curso...`);
    detenido = true;
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

function dormir(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tick() {
    const resultados = await evaluarReglasPendientes();
    for (const r of resultados) {
        if (r.error) {
            console.error(`[Analisis/Reglas] Regla ${r.clave}: error — ${r.error}`);
        } else if (r.creadas > 0 || r.actualizadas > 0 || (r.ejecutadas ?? 0) > 0 || (r.fallidasEjecucion ?? 0) > 0) {
            const extra = r.ejecutadas !== undefined
                ? `, acciones: ${r.ejecutadas} ejecutadas, ${r.fallidasEjecucion} fallidas`
                : "";
            console.log(
                `[Analisis/Reglas] Regla ${r.clave}: ${r.candidatos} candidatos, ${r.creadas} creadas, ${r.actualizadas} actualizadas${extra}`
            );
        }
    }
    const expiradas = await expirarRecomendacionesVencidas();
    if (expiradas > 0) {
        console.log(`[Analisis/Reglas] Expiración: ${expiradas} recomendaciones marcadas EXPIRADA`);
    }
}

async function main() {
    await acquireAdvisoryLock();
    console.log(`[Analisis/Reglas] Worker iniciado (tick cada ${TICK_MS / 1000}s).`);
    while (!detenido) {
        try {
            await tick();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[Analisis/Reglas] Error en tick: ${msg}`);
        }
        if (!detenido) await dormir(TICK_MS);
    }
    await releaseAdvisoryLock();
    console.log("[Analisis/Reglas] Worker detenido limpio.");
    process.exit(0);
}

main().catch((err) => {
    console.error("[Analisis/Reglas] Fatal:", err instanceof Error ? err.message : String(err));
    process.exit(1);
});
