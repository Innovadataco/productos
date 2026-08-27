#!/usr/bin/env node
/**
 * Worker de notificaciones (SPEC-201).
 *
 * - Consume la cola `notificacion-envio` de pg-boss.
 * - Hace polling de la tabla `Notificacion` buscando estado ENCOLADA/REINTENTANDO
 *   con `enviarEn <= now()`.
 * - Respeta quiet hours (ventana de silencio configurable).
 * - Envía EMAIL vía Resend (`src/lib/email.ts`) e IN_APP localmente.
 * - Reintentos con backoff parametrizable desde `ParametroSistema`.
 * - Gestión de bounces: umbral configurable → bloqueo + notificación a admin.
 * - Idempotencia por `proveedorId` en webhooks Resend.
 *
 * Instancia única vía advisory lock de PostgreSQL.
 */

import { PgBoss } from "pg-boss";
import pg from "pg";
import { enviarEmailNotificacion } from "../src/lib/email.ts";
import { getParametroSistemaValor } from "../src/lib/parametros.ts";
import { workerLogger } from "../src/lib/monitoreo/worker-logger.ts";
import { NotificacionRepository } from "../src/lib/dal/repositories/notificacion.ts";
import { NotificacionPlantillaRepository } from "../src/lib/dal/repositories/notificacion-plantilla.ts";
// SPEC-292 (002-PI-192 · cierra I-147): la lógica del ciclo vive en un módulo
// TS puro para poder testearla con Vitest sin arrancar pg-boss.
import { procesarLote } from "../src/lib/notificaciones/procesar-lote.ts";
import { iniciarTickVida } from "../src/lib/monitoreo/tick-vida.ts";

iniciarTickVida("pi-notificaciones"); // SPEC-291: healthcheck externo + monitor

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[PI-NOTIFICACIONES] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const ADVISORY_LOCK_ID = 987654321;
let lockClient = null;

const boss = new PgBoss(DATABASE_URL);
const logger = workerLogger.child({ servicio: "pi-notificaciones" });

const repoNotif = new NotificacionRepository();
const repoPlantilla = new NotificacionPlantillaRepository();

const PARAM_TTL_MS = 60_000;
let configCache = null;
// SPEC-292 (I-147): elevado a scope de módulo para que `shutdown()` pueda
// `clearInterval`. Sin esto, quitar `.unref()` deja el proceso colgado en SIGTERM.
let pollInterval = null;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[PI-NOTIFICACIONES] Lock de instancia ya está en uso; otro worker está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[PI-NOTIFICACIONES] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[PI-NOTIFICACIONES] Advisory lock liberado.");
        } catch (err) {
            console.error("[PI-NOTIFICACIONES] Error liberando advisory lock:", err.message);
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
    logger.warn("Worker de notificaciones cerrándose por señal", { signal });
    console.log(`[PI-NOTIFICACIONES] Señal ${signal} recibida; liberando lock...`);
    // SPEC-292 (I-147): el pollInterval ya NO tiene `.unref()` — hay que
    // limpiarlo explícitamente para que node no quede colgado.
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function leerConfig() {
    const ahora = Date.now();
    if (configCache && ahora - configCache.leidoEn < PARAM_TTL_MS) {
        return configCache;
    }

    const [
        intervaloRaw,
        maxIntentosRaw,
        backoffRaw,
        loteSizeRaw,
        quietHoursRaw,
    ] = await Promise.all([
        getParametroSistemaValor("notificaciones.worker.intervalo_segundos"),
        getParametroSistemaValor("notificaciones.worker.max_intentos"),
        getParametroSistemaValor("notificaciones.worker.backoff_segundos"),
        getParametroSistemaValor("notificaciones.worker.lote_size"),
        getParametroSistemaValor("notificaciones.horario.silencio"),
    ]);

    let backoffSegundos = [60, 300, 1800, 7200];
    try {
        const parsed = JSON.parse(backoffRaw ?? "[60,300,1800,7200]");
        if (Array.isArray(parsed) && parsed.every((n) => Number.isFinite(n) && n >= 0)) {
            backoffSegundos = parsed;
        }
    } catch {
        // mantener default
    }

    configCache = {
        intervaloSegundos: parseInt(intervaloRaw ?? "10", 10) || 10,
        maxIntentos: parseInt(maxIntentosRaw ?? "4", 10) || 4,
        backoffSegundos,
        loteSize: parseInt(loteSizeRaw ?? "20", 10) || 20,
        quietHours: quietHoursRaw ?? "20:00-07:00",
        leidoEn: ahora,
    };

    return configCache;
}

// SPEC-292 (I-147): la lógica de `procesarNotificacion` y `procesarLote`
// vive en `src/lib/notificaciones/procesar-lote.ts` (módulo TS puro,
// testeable con Vitest). Este worker solo orquesta arranque, lock, pg-boss
// y polling. Las dependencias inyectables se arman en `start()`.
function armarDepsProcesarLote() {
    return {
        repoNotif,
        repoPlantilla,
        enviarEmail: enviarEmailNotificacion,
        logger: {
            info: (msg, meta) => {
                logger.info(msg, meta).catch(() => {});
            },
            warn: (msg, meta) => {
                logger.warn(msg, meta).catch(() => {});
            },
        },
    };
}

function armarConfigProcesarLote(config) {
    return {
        quietHours: config.quietHours,
        maxIntentos: config.maxIntentos,
        backoffSegundos: config.backoffSegundos,
        loteSize: config.loteSize,
    };
}

async function correrLote() {
    const config = await leerConfig();
    return procesarLote(armarDepsProcesarLote(), armarConfigProcesarLote(config));
}

async function start() {
    await acquireAdvisoryLock();
    await logger.info("Worker de notificaciones iniciado", { pid: process.pid });

    await boss.start();
    try {
        await boss.createQueue("notificacion-envio");
        console.log("[PI-NOTIFICACIONES] Cola 'notificacion-envio' creada");
    } catch {
        console.log("[PI-NOTIFICACIONES] Cola 'notificacion-envio' ya existe");
    }

    const config = await leerConfig();
    console.log(
        `[PI-NOTIFICACIONES] Config: intervalo=${config.intervaloSegundos}s, max_intentos=${config.maxIntentos}, lote=${config.loteSize}, quietHours=${config.quietHours}`
    );

    // Suscripción a la cola pg-boss: cada job dispara un poll.
    await boss.work("notificacion-envio", async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        const jobId = job?.id;
        logger.info("Job de notificacion-envio recibido", { jobId }).catch(() => {});
        await correrLote();
    });

    // Polling de respaldo para reintentos y jobs perdidos.
    // SPEC-292 (I-147): SIN `.unref()`. Con `.unref()` el timer no cuenta
    // contra keep-alive de libuv y no dispara cuando pg-boss queda en espera
    // silenciosa — dejando la cola de Notificacion sin procesar. El
    // `shutdown()` llama a `clearInterval(pollInterval)` para cerrar limpio.
    const intervaloMs = Math.max(1, config.intervaloSegundos) * 1000;
    pollInterval = setInterval(() => {
        correrLote().catch((err) => {
            console.error("[PI-NOTIFICACIONES] Error en polling periódico:", err instanceof Error ? err.message : err);
        });
    }, intervaloMs);

    // Primer poll inmediato.
    await correrLote();
}

start().catch(async (err) => {
    console.error("[PI-NOTIFICACIONES] Fatal:", err instanceof Error ? err.message : err);
    await releaseAdvisoryLock();
    process.exit(1);
});
