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
import { prisma } from "../src/lib/prisma.ts";
import { getParametroSistemaValor } from "../src/lib/parametros.ts";
import { workerLogger } from "../src/lib/monitoreo/worker-logger.ts";
import { NotificacionRepository } from "../src/lib/dal/repositories/notificacion.ts";
import { NotificacionContactoBloqueadoRepository } from "../src/lib/dal/repositories/notificacion-contacto-bloqueado.ts";
import { NotificacionPlantillaRepository } from "../src/lib/dal/repositories/notificacion-plantilla.ts";
import { renderizarPlantilla } from "../src/lib/notificaciones/renderer.ts";
import { registrarBounce, emailBloqueado } from "../src/lib/notificaciones/bounces.ts";
import { aplicarQuietHours } from "../src/lib/notificaciones/quiet-hours.ts";
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
const repoBloqueado = new NotificacionContactoBloqueadoRepository();
const repoPlantilla = new NotificacionPlantillaRepository();

const PARAM_TTL_MS = 60_000;
let configCache = null;

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

function calcularBackoff(intentos, backoffSegundos) {
    const idx = Math.min(intentos, backoffSegundos.length) - 1;
    const segundos = backoffSegundos[Math.max(0, idx)] ?? backoffSegundos[backoffSegundos.length - 1] ?? 60;
    return new Date(Date.now() + segundos * 1000);
}

async function procesarNotificacion(notificacion, config) {
    const ahora = new Date();

    // Quiet hours: si la notificación fue programada dentro de la ventana de
    // silencio, el motor ya debería haberla diferido al programar. Este segundo
    // chequeo protege contra cambios de regla/parámetro en caliente.
    if (notificacion.enviarEn && aplicarQuietHours(notificacion.enviarEn, config.quietHours).getTime() > ahora.getTime()) {
        return { accion: "diferida_quiet_hours" };
    }

    if (notificacion.canal === "EMAIL") {
        if (await emailBloqueado(notificacion.destinatarioEmail)) {
            await repoNotif.marcarCancelada(notificacion.id, "contacto_bloqueado");
            return { accion: "cancelada_por_bloqueo" };
        }
    }

    const plantilla = await repoPlantilla.findByClaveYCanal(notificacion.plantillaClave, notificacion.canal);
    if (!plantilla) {
        await repoNotif.marcarFallida(notificacion.id, "Plantilla no encontrada");
        return { accion: "fallida_sin_plantilla" };
    }

    await repoNotif.marcarEnviando(notificacion.id);

    try {
        if (notificacion.canal === "EMAIL") {
            const variables = (notificacion.variables ?? {}) ;
            const renderizado = renderizarPlantilla(plantilla.cuerpoMarkdown, plantilla.asunto, variables);
            const { id: proveedorId } = await enviarEmailNotificacion(
                notificacion.destinatarioEmail,
                renderizado.asunto ?? "Notificación",
                renderizado.cuerpo
            );
            await repoNotif.marcarEnviada(notificacion.id, proveedorId);
            return { accion: "enviada_email", proveedorId };
        }

        if (notificacion.canal === "IN_APP") {
            await repoNotif.marcarEnviada(notificacion.id);
            return { accion: "enviada_in_app" };
        }

        return { accion: "canal_desconocido" };
    } catch (err) {
        const mensaje = err instanceof Error ? err.message : "Error desconocido";
        console.error(`[PI-NOTIFICACIONES] Error enviando notificación ${notificacion.id}: ${mensaje}`);

        // Detectar bounces sintéticos (la mayoría son asíncronos vía webhook).
        const esBounce = /bounce|rejected|invalid|hard.?bounce/i.test(mensaje);
        if (esBounce) {
            await registrarBounce(notificacion.destinatarioEmail, "hard_bounce");
        }

        const nuevoIntento = notificacion.intentos + 1;
        if (nuevoIntento >= config.maxIntentos) {
            await prisma.notificacion.update({
                where: { id: notificacion.id },
                data: {
                    estado: "FALLIDA",
                    intentos: nuevoIntento,
                    ultimoError: mensaje,
                },
            });
            return { accion: "fallida_final" };
        }

        const proximoIntento = calcularBackoff(nuevoIntento, config.backoffSegundos);
        await repoNotif.marcarFallida(notificacion.id, mensaje, proximoIntento);
        return { accion: "reintentando" };
    }
}

async function procesarLote() {
    const config = await leerConfig();
    const ahora = new Date();

    const pendientes = await repoNotif.listarPendientesParaEnvio(ahora, config.loteSize);
    if (pendientes.length === 0) return { procesadas: 0 };

    logger.info("Procesando lote de notificaciones", { pendientes: pendientes.length });
    let procesadas = 0;

    for (const notificacion of pendientes) {
        try {
            await procesarNotificacion(notificacion, config);
            procesadas++;
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[PI-NOTIFICACIONES] Error crítico procesando notificación ${notificacion.id}: ${mensaje}`);
            await repoNotif.marcarFallida(notificacion.id, mensaje);
        }
    }

    logger.info("Lote procesado", { procesadas });
    return { procesadas };
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
        await procesarLote();
    });

    // Polling de respaldo para reintentos y jobs perdidos.
    const intervaloMs = Math.max(1, config.intervaloSegundos) * 1000;
    const pollInterval = setInterval(() => {
        procesarLote().catch((err) => {
            console.error("[PI-NOTIFICACIONES] Error en polling periódico:", err instanceof Error ? err.message : err);
        });
    }, intervaloMs);
    pollInterval.unref();

    // Primer poll inmediato.
    await procesarLote();
}

start().catch(async (err) => {
    console.error("[PI-NOTIFICACIONES] Fatal:", err instanceof Error ? err.message : err);
    await releaseAdvisoryLock();
    process.exit(1);
});
