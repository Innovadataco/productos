#!/usr/bin/env node
/**
 * SPEC-657 (I-389) · worker del barrido de citas profesionales.
 *
 * Cablea los dos barredores de `src/lib/profesional/cita/worker.ts` (SPEC-395),
 * que estaban escritos, probados y con candado de repetición pero SIN un solo
 * llamador. Sin este worker: un padre que ya pagó y cuyo profesional no responde
 * en 48 h nunca se entera y la franja no se libera; y una solicitud impaga
 * bloquea la agenda del profesional para siempre.
 *
 * Este worker es la cáscara —lock, cola, cron, señal de vida—; la corrida
 * (`ejecutarBarridoCitas`) vive en el módulo cita.
 *
 * - Instancia única vía advisory lock de PostgreSQL (id 123456801; ver
 *   `scripts/ADVISORY-LOCKS.md`). Si hay otra instancia, sale con código 2.
 * - pg-boss: `createQueue` ANTES de `schedule`/`work` (I-131). Sin eso el worker
 *   entra en bucle de reinicio con «Queue not found».
 * - Cadencia cada 15 min por defecto, parametrizada en `cita.barrido.cron`
 *   (SPEC-657, decisión CEO). Superposición: single-flight por el advisory lock
 *   + job serializado; y aun si dos se solaparan, los barredores son idempotentes
 *   (candado I-280 del aviso + transición one-way a VENCIDA + franja ya liberada).
 * - `--now`: ejecuta el barrido una vez y termina (pruebas manuales / e2e).
 */

import { ejecutarBarridoCitas } from "../src/lib/profesional/cita/worker.ts";
import { cronBarridoCitas, CLAVE_CRON_BARRIDO_CITAS } from "../src/lib/profesional/cita/cron-barrido.ts";
import { boss, ensureStarted } from "../src/lib/queue.ts";
import { getParametroSistemaValor } from "../src/lib/parametros.ts";
import pg from "pg";
import { iniciarTickVida } from "../src/lib/monitoreo/tick-vida.ts";

iniciarTickVida("pi-citas"); // SPEC-291: healthcheck externo + monitor

const { Client } = pg;
// SPEC-657: siguiente id libre del pool principal (789..800 tomados). Al tomarlo,
// ADVISORY-LOCKS.md avanza el "siguiente libre" a 123456802.
const ADVISORY_LOCK_ID = 123456801;
const COLA = "cita-barrido-vencimientos";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[CITAS] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const MODO_NOW = process.argv.includes("--now");

let lockClient = null;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[CITAS] Lock de instancia ya está en uso; otro worker de citas está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[CITAS] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[CITAS] Advisory lock liberado.");
        } catch (err) {
            console.error("[CITAS] Error liberando advisory lock:", err.message);
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
    console.log(`[CITAS] Señal de terminación recibida (${signal}); liberando lock...`);
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function correr() {
    const r = await ejecutarBarridoCitas();
    console.log(
        `[CITAS] Barrido terminado: aviso48h ${r.aviso48h.avisadas}/${r.aviso48h.encontradas} avisadas ` +
            `(${r.aviso48h.saltadas} saltadas, ${r.aviso48h.profesionalesEvaluados} profesionales evaluados); ` +
            `plazo-pago ${r.plazoPago.expiradas}/${r.plazoPago.encontradas} expiradas, ` +
            `${r.plazoPago.franjasLiberadas} franjas liberadas por impago.`
    );
    return r;
}

async function start() {
    await acquireAdvisoryLock();

    if (MODO_NOW) {
        try {
            await correr();
            await releaseAdvisoryLock();
            process.exit(0);
        } catch (err) {
            console.error("[CITAS] Fatal en barrido --now:", err instanceof Error ? err.message : err);
            await releaseAdvisoryLock();
            process.exit(1);
        }
    }

    await ensureStarted();
    await boss.createQueue(COLA).catch(() => {});

    const cron = cronBarridoCitas(await getParametroSistemaValor(CLAVE_CRON_BARRIDO_CITAS));
    console.log(`[CITAS] Programando barrido con cron: ${cron} (America/Bogota)`);
    await boss.schedule(COLA, cron, {}, { tz: "America/Bogota" });

    await boss.work(COLA, async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        console.log(`[CITAS] Procesando job ${job?.id}`);
        try {
            const resultado = await correr();
            return { success: true, ...resultado };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[CITAS] Error en barrido: ${msg}`);
            throw err;
        }
    });
}

start().catch((err) => {
    console.error("[CITAS] Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
});
