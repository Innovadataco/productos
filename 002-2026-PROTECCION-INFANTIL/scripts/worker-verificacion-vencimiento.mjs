#!/usr/bin/env node
/**
 * SPEC-449 (I-313) · el reloj de la verificación del profesional.
 *
 * La Ley 2375/2024 obliga a revalidar antecedentes cada 4 meses. SPEC-389
 * escribió y probó la lógica (`decidirAcciones`) y **nunca la llamó nadie**:
 * hasta esta spec, **nada en todo el árbol escribía `estado = "VENCIDO"`**, así
 * que un profesional cuyos antecedentes caducaron seguía en el directorio del
 * padre para siempre.
 *
 * Este worker es la cáscara —lock, cola, cron, logging—; la corrida vive en
 * `src/lib/profesionales/corrida-vencimiento.service.ts`, del lado testeable.
 *
 * - Instancia única con advisory lock (id 123456800; si hay otra, sale con 2).
 * - pg-boss: `createQueue` **antes** de `schedule`/`work`. Sin eso el worker
 *   entra en bucle de reinicio y el monitor lo ve VERDE igual (I-131).
 * - Corre diario a la hora de `profesional.verificacion.hora_corrida`
 *   (default 02:00 Bogotá).
 * - `--now`: corre una vez y termina (pruebas manuales).
 */

import { ejecutarCorridaVencimiento } from "../src/lib/profesionales/corrida-vencimiento.service.ts";
import { horaCorridaACronVerificacion } from "../src/lib/profesionales/hora-corrida.ts";
import { boss, ensureStarted } from "../src/lib/queue.ts";
import { getParametroSistemaValor } from "../src/lib/parametros.ts";
import pg from "pg";
import { iniciarTickVida } from "../src/lib/monitoreo/tick-vida.ts";

iniciarTickVida("pi-verificacion-vencimiento"); // SPEC-291: healthcheck + monitor

const { Client } = pg;
// SPEC-449: id exclusivo de este worker. Tomado de scripts/ADVISORY-LOCKS.md
// (siguiente libre declarado allí). Sin `_` porque `npm run locks:check` lee el
// literal con una expresión regular y la tabla tiene que quedar 1:1.
const ADVISORY_LOCK_ID = 123456800;
const COLA = "profesional-verificacion-vencimiento";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[VERIFICACION] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const MODO_NOW = process.argv.includes("--now");

let lockClient = null;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[VERIFICACION] Lock de instancia ya está en uso; otro worker está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[VERIFICACION] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[VERIFICACION] Advisory lock liberado.");
        } catch (err) {
            console.error("[VERIFICACION] Error liberando advisory lock:", err.message);
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
    console.log(`[VERIFICACION] Señal de terminación recibida (${signal}); liberando lock...`);
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function correr() {
    const r = await ejecutarCorridaVencimiento();
    console.log(
        `[VERIFICACION] Corrida terminada: ${r.vencidos} perfil(es) a VENCIDO, ` +
            `${r.avisados} aviso(s) programado(s), ${r.yaAplicadas} ya aplicada(s) por otra corrida.`
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
            console.error("[VERIFICACION] Fatal en corrida --now:", err instanceof Error ? err.message : err);
            await releaseAdvisoryLock();
            process.exit(1);
        }
    }

    await ensureStarted();
    // I-131: crear la cola ANTES de agendarla o consumirla.
    await boss.createQueue(COLA).catch(() => {});

    const hora = await getParametroSistemaValor("profesional.verificacion.hora_corrida");
    const cron = horaCorridaACronVerificacion(hora);
    console.log(`[VERIFICACION] Programando corrida diaria con cron: ${cron} (America/Bogota)`);
    await boss.schedule(COLA, cron, {}, { tz: "America/Bogota" });

    await boss.work(COLA, async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        console.log(`[VERIFICACION] Procesando job ${job?.id}`);
        try {
            const resultado = await correr();
            return { success: true, ...resultado };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[VERIFICACION] Error en corrida diaria: ${msg}`);
            throw err;
        }
    });
}

start().catch((err) => {
    console.error("[VERIFICACION] Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
});
