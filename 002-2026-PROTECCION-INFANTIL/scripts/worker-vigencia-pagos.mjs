#!/usr/bin/env node
/**
 * Worker del motor de vigencia de pagos (SPEC-213, 002-PI-113).
 *
 * Ejecuta la corrida diaria de transiciones automáticas de suscripciones
 * (ACTIVA → EN_GRACIA → SUSPENDIDA y corte freemium) definida en
 * src/lib/pagos/vigencia.service.ts.
 *
 * - Instancia única vía advisory lock de PostgreSQL (id exclusivo 123456792;
 *   si hay otra instancia activa, sale con código 2).
 * - Scheduling interno con pg-boss: corre diario a la hora configurable en
 *   ParametroSistema `pagos.vigencia.hora_corrida` (default 01:00 Bogotá).
 * - `--now`: ejecuta la corrida inmediatamente y termina (pruebas manuales).
 * - La corrida es idempotente por día Bogotá (`pagos.vigencia.ultima_corrida`).
 */

import { ejecutarCorrida, horaCorridaACron } from "../src/lib/pagos/vigencia.service.ts";
import { boss, ensureStarted } from "../src/lib/queue.ts";
import { getParametroSistemaValor } from "../src/lib/parametros.ts";
import pg from "pg";
import { iniciarTickVida } from "../src/lib/monitoreo/tick-vida.ts";

iniciarTickVida("pi-vigencia"); // SPEC-291: healthcheck externo + monitor

const { Client } = pg;
// SPEC-213: id exclusivo del worker de vigencia (789 reportes, 790 tasas/sesiones/señal/monitor,
// 791 reservado por otro worker del lote, 923456789 simulador, 987654321 notificaciones).
const ADVISORY_LOCK_ID = 123456792;
const COLA = "pagos-vigencia-diaria";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[VIGENCIA] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const MODO_NOW = process.argv.includes("--now");

let lockClient = null;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[VIGENCIA] Lock de instancia ya está en uso; otro worker de vigencia está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[VIGENCIA] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[VIGENCIA] Advisory lock liberado.");
        } catch (err) {
            console.error("[VIGENCIA] Error liberando advisory lock:", err.message);
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
    console.log(`[VIGENCIA] Señal de terminación recibida (${signal}); liberando lock...`);
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function correr() {
    const resultado = await ejecutarCorrida();
    console.log(
        `[VIGENCIA] Corrida terminada: ${resultado.transiciones.length} transiciones, ` +
            `${resultado.eventosProgramados} notificaciones programadas` +
            (resultado.omitida ? " (omitida: ya corrida hoy)" : "")
    );
    return resultado;
}

async function start() {
    await acquireAdvisoryLock();

    if (MODO_NOW) {
        try {
            await correr();
            await releaseAdvisoryLock();
            process.exit(0);
        } catch (err) {
            console.error("[VIGENCIA] Fatal en corrida --now:", err instanceof Error ? err.message : err);
            await releaseAdvisoryLock();
            process.exit(1);
        }
    }

    await ensureStarted();
    await boss.createQueue(COLA).catch(() => {});

    const hora = await getParametroSistemaValor("pagos.vigencia.hora_corrida");
    const cron = horaCorridaACron(hora);
    console.log(`[VIGENCIA] Programando corrida diaria con cron: ${cron} (America/Bogota)`);
    await boss.schedule(COLA, cron, {}, { tz: "America/Bogota" });

    await boss.work(COLA, async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        console.log(`[VIGENCIA] Procesando job ${job?.id}`);
        try {
            const resultado = await correr();
            return { success: true, ...resultado };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[VIGENCIA] Error en corrida diaria: ${msg}`);
            throw err;
        }
    });
}

start().catch((err) => {
    console.error("[VIGENCIA] Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
});
