#!/usr/bin/env node
/**
 * SPEC-171 (Pilar B, I-51) — Vigilante de infraestructura: probes periódicos de
 * app / worker / BD / Ollama (ping + smoke) / Tailscale con ciclo de vida de
 * incidentes (doble rojo antes de abrir, resolución automática al volver a
 * verde, email con throttle por señal). Instancia única vía advisory lock de
 * PostgreSQL (exit 2 si ya hay otro monitor activo, igual que worker-reportes).
 *
 * Arranque: node --env-file-if-exists=.env --import tsx scripts/monitor-probes.mjs
 * (scripts/dev-restart.sh lo levanta junto a la app y el worker de reportes).
 *
 * Configuración dinámica (ParametroSistema, se relee en cada ciclo):
 * - monitoreo.enabled                     (apaga todo el vigilante)
 * - monitoreo.app.intervalo_seg           (también cadencia de worker y bd)
 * - monitoreo.worker.heartbeat_max_seg
 * - monitoreo.ollama.ping.intervalo_seg
 * - monitoreo.ollama.smoke.intervalo_min / .timeout_ms / .piggyback_min
 * - monitoreo.tailscale.url               (vacío = no aplica) / .intervalo_seg
 * - monitoreo.reprobe.segundos            (espera antes de confirmar un rojo)
 * Retención: HealthProbe se purga cada hora (7 días).
 */

import pg from "pg";
import { prisma } from "../src/lib/prisma.ts";
import { getParametroSistema } from "../src/lib/parametros.ts";
import { getOllamaBaseUrl } from "../src/lib/ai/ollama-config.ts";
import {
    probeApp,
    probeWorker,
    probeBd,
    probeOllamaPing,
    probeOllamaSmoke,
    probeTailscale,
    probeIndices,
    probeNotifPendientesVencidas,
} from "../src/lib/monitoreo/probes.ts";
import { registrarProbe, evaluarSenal, confirmarRojo } from "../src/lib/monitoreo/incidentes.ts";
import { revisarSlaSpam } from "../src/lib/spam/sla.ts";
import { iniciarTickVida } from "../src/lib/monitoreo/tick-vida.ts";
// SPEC-291 (002-PI-191): probe genérico basado en tick-vida para los 7 workers.
import { probeTickVida, SENALES_TICK_VIDA } from "../src/lib/monitoreo/probes.ts";

iniciarTickVida("pi-monitor"); // SPEC-291: healthcheck externo del propio monitor

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[MONITOR] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5005";
const ADVISORY_LOCK_ID = 123456790;
// Tick fijo de 5s: granularidad fina y barata; cada tick relee la config y
// evalúa qué señales tocan según su intervalo (acotado por el mínimo vigente).
const TICK_MS = 5000;
const LIMPIEZA_CADA_MS = 60 * 60 * 1000;
const SLA_SPAM_INTERVALO_MS = 15 * 60 * 1000;
// SPEC-251 (I-49): se agrega "indices" al pool de señales del monitor.
// SPEC-302 (002-PI-208 · I-147): "notif_pendientes_vencidas" — cola de
// notificaciones ENCOLADA vencida (worker vivo ≠ cola avanzando).
const SENALES = [
    "app", "worker", "bd", "ollama_ping", "ollama_smoke", "tailscale", "indices",
    "notif_pendientes_vencidas",
    ...SENALES_TICK_VIDA,
];

// --- Advisory lock (instancia única, patrón de worker-reportes.mjs) ---
const { Client } = pg;
let lockClient = null;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[MONITOR] Lock de instancia ya está en uso; otro monitor está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[MONITOR] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
        } catch (err) {
            console.error("[MONITOR] Error liberando advisory lock:", err.message);
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

async function shutdown() {
    console.log("[MONITOR] Señal de terminación recibida; cerrando...");
    await releaseAdvisoryLock();
    try {
        await prisma.$disconnect();
    } catch {
        // ignore
    }
    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// --- Config dinámica ---
function enteroPositivo(valor, fallback) {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

async function leerConfig() {
    const entero = async (clave, fallback) => enteroPositivo((await getParametroSistema(clave))?.valor, fallback);
    const enabledParam = await getParametroSistema("monitoreo.enabled");
    const tailscaleParam = await getParametroSistema("monitoreo.tailscale.url");
    return {
        enabled: enabledParam ? enabledParam.valor === "true" : true,
        appIntervaloSeg: await entero("monitoreo.app.intervalo_seg", 60),
        heartbeatMaxSeg: await entero("monitoreo.worker.heartbeat_max_seg", 90),
        ollamaPingIntervaloSeg: await entero("monitoreo.ollama.ping.intervalo_seg", 60),
        ollamaSmokeIntervaloSeg: (await entero("monitoreo.ollama.smoke.intervalo_min", 30)) * 60,
        ollamaSmokeTimeoutMs: await entero("monitoreo.ollama.smoke.timeout_ms", 60000),
        ollamaSmokePiggybackMin: await entero("monitoreo.ollama.smoke.piggyback_min", 15),
        tailscaleUrl: (tailscaleParam?.valor ?? "").trim(),
        tailscaleIntervaloSeg: await entero("monitoreo.tailscale.intervalo_seg", 60),
        reprobeSeg: await entero("monitoreo.reprobe.segundos", 60),
        // SPEC-251 (I-49): frecuencia del guardián de índices (default: 1×/día).
        indicesIntervaloSeg: (await entero("monitoreo.indices.frecuencia_horas", 24)) * 3600,
        // SPEC-291 (002-PI-191): antigüedad máxima aceptada del tick-vida antes de marcar rojo.
        tickVidaMaxSeg: await entero("monitoreo.tickVida.maxAntiguedadSeg", 90),
    };
}

function intervaloDe(senal, config) {
    switch (senal) {
        case "ollama_ping": return config.ollamaPingIntervaloSeg;
        case "ollama_smoke": return config.ollamaSmokeIntervaloSeg;
        case "tailscale": return config.tailscaleIntervaloSeg;
        case "indices": return config.indicesIntervaloSeg; // SPEC-251: 1×/día por defecto
        default:
            // SPEC-291: las 7 señales tick-vida usan la cadencia base (app/worker/bd).
            return config.appIntervaloSeg;
    }
}

async function correrProbe(senal, config) {
    try {
        switch (senal) {
            case "app": return await probeApp({ url: API_BASE_URL });
            case "worker": return probeWorker({ heartbeatMaxSeg: config.heartbeatMaxSeg });
            case "bd": return await probeBd();
            case "ollama_ping": return await probeOllamaPing({ baseUrl: await getOllamaBaseUrl() });
            case "ollama_smoke": return await probeOllamaSmoke({
                baseUrl: await getOllamaBaseUrl(),
                timeoutMs: config.ollamaSmokeTimeoutMs,
                piggybackMin: config.ollamaSmokePiggybackMin,
                intervaloMin: config.ollamaSmokeIntervaloSeg / 60,
            });
            case "tailscale": return await probeTailscale({ url: config.tailscaleUrl });
            // SPEC-251 (I-49): guardián de índices. NUNCA reinicia nada.
            case "indices": return await probeIndices();
            // SPEC-302 (002-PI-208 · I-147): cola de notificaciones vencida.
            case "notif_pendientes_vencidas": return await probeNotifPendientesVencidas();
            default:
                // SPEC-291: 7 señales por tick-vida (workers propios).
                if (SENALES_TICK_VIDA.includes(senal)) {
                    return probeTickVida(senal, config.tickVidaMaxSeg);
                }
                throw new Error(`Señal desconocida: ${senal}`);
        }
    } catch (err) {
        // Un probe que lanza (p.ej. URL de Ollama inválida) cuenta como fallo.
        return { ok: false, latenciaMs: 0, detalle: err instanceof Error ? err.message : String(err) };
    }
}

// --- Loop principal ---
const proximoProbeEn = new Map(); // senal -> epoch ms del próximo probe programado
const reprobes = new Map();       // senal -> { en: epoch ms } (segundo intento tras un fallo)
let proximaLimpiezaEn = Date.now() + LIMPIEZA_CADA_MS;
let proximoSlaSpamEn = Date.now() + SLA_SPAM_INTERVALO_MS;

async function procesarTick() {
    const config = await leerConfig();
    if (!config.enabled) return;
    const ahora = Date.now();

    for (const senal of SENALES) {
        // Con un re-probe pendiente, la cadencia regular de la señal queda en pausa.
        if (reprobes.has(senal)) {
            const reprobe = reprobes.get(senal);
            if (reprobe.en > ahora) continue;
            reprobes.delete(senal);
            proximoProbeEn.set(senal, ahora + intervaloDe(senal, config) * 1000);
            const resultado = await correrProbe(senal, config);
            await registrarProbe(senal, resultado);
            if (resultado.ok) {
                const evaluacion = await evaluarSenal(senal, resultado);
                if (evaluacion === "resuelto") console.log(`[MONITOR] ${senal} volvió a verde — incidente resuelto`);
            } else {
                await confirmarRojo(senal, resultado.detalle);
                console.error(`[MONITOR] ${senal} en ROJO confirmado (segundo fallo): ${resultado.detalle ?? "sin detalle"}`);
            }
            continue;
        }

        if ((proximoProbeEn.get(senal) ?? 0) > ahora) continue;
        proximoProbeEn.set(senal, ahora + intervaloDe(senal, config) * 1000);
        const resultado = await correrProbe(senal, config);
        await registrarProbe(senal, resultado);
        const evaluacion = await evaluarSenal(senal, resultado);
        if (evaluacion === "pendiente-reprobe") {
            reprobes.set(senal, { en: ahora + config.reprobeSeg * 1000 });
            console.error(`[MONITOR] ${senal} falló (primer intento) — re-probe en ${config.reprobeSeg}s: ${resultado.detalle ?? "sin detalle"}`);
        } else if (evaluacion === "resuelto") {
            console.log(`[MONITOR] ${senal} volvió a verde — incidente resuelto`);
        }
    }
}

async function limpiarProbesViejos() {
    const borrados = await prisma.$executeRaw`DELETE FROM "HealthProbe" WHERE "creadoEn" < NOW() - INTERVAL '7 days'`;
    if (borrados > 0) console.log(`[MONITOR] Limpieza de HealthProbe: ${borrados} filas purgadas (>7 días)`);
}

async function start() {
    await acquireAdvisoryLock();
    console.log(`[MONITOR] Iniciado. Vigilando ${SENALES.length} señales contra ${API_BASE_URL} (tick ${TICK_MS / 1000}s).`);

    let corriendo = false;
    const loop = async () => {
        if (!corriendo) {
            corriendo = true;
            try {
                await procesarTick();
                if (Date.now() >= proximoSlaSpamEn) {
                    proximoSlaSpamEn = Date.now() + SLA_SPAM_INTERVALO_MS;
                    try {
                        await revisarSlaSpam();
                    } catch (err) {
                        console.error("[MONITOR] Error revisando SLA SPAM:", err instanceof Error ? err.message : err);
                    }
                }
                if (Date.now() >= proximaLimpiezaEn) {
                    proximaLimpiezaEn = Date.now() + LIMPIEZA_CADA_MS;
                    await limpiarProbesViejos();
                }
            } catch (err) {
                console.error("[MONITOR] Error en ciclo:", err instanceof Error ? err.message : err);
            } finally {
                corriendo = false;
            }
        }
        setTimeout(loop, TICK_MS);
    };
    await loop();
}

start().catch((err) => {
    console.error("[MONITOR] Fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
});
