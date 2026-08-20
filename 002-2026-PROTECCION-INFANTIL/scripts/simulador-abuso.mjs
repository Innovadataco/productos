#!/usr/bin/env node
/**
 * SPEC-184 (002-PI-079): worker de simulación de abusos.
 *
 * Proceso separado con advisory lock propio. Consume jobs `simulacion-abuso`
 * de pg-boss y envía reportes REALES al endpoint público `/api/reportes`
 * inyectando `x-forwarded-for` desde rangos RFC 5737.
 *
 * No usa `X-Worker-Secret` porque `/api/reportes` es público por diseño.
 */

import { fetchWithRetry } from "../src/lib/fetch-retry.ts";
import { boss, ensureStarted } from "../src/lib/queue.ts";
import { prisma } from "../src/lib/prisma.ts";
import { SimulacionAbusoRepository } from "../src/lib/dal/repositories/simulacion-abuso.ts";
import { generarPayloads } from "../src/lib/anti-abuso/simulador.ts";
import { logAudit } from "../src/lib/audit.ts";
import pg from "pg";

const { Client } = pg;
const ADVISORY_LOCK_ID = 923456789;
let lockClient = null;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[SIMULADOR-ABUSO] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5005";

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[SIMULADOR-ABUSO] Lock de instancia ya está en uso; otro simulador está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[SIMULADOR-ABUSO] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[SIMULADOR-ABUSO] Advisory lock liberado.");
        } catch (err) {
            console.error("[SIMULADOR-ABUSO] Error liberando advisory lock:", err.message);
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
    console.log("[SIMULADOR-ABUSO] Señal de terminación recibida; liberando lock...");
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function ensureQueue(name) {
    try {
        await boss.createQueue(name);
        console.log(`[SIMULADOR-ABUSO] Cola '${name}' creada`);
    } catch {
        console.log(`[SIMULADOR-ABUSO] Cola '${name}' ya existe`);
    }
}

/**
 * Envía un reporte simulado al endpoint público. Devuelve el status y la
 * latencia en ms.
 */
async function enviarReporte(payload, ip) {
    const startMs = Date.now();
    const res = await fetchWithRetry(`${API_BASE_URL}/api/reportes`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
            "user-agent": "ProteccionInfantil-SimuladorAbuso/1.0",
        },
        body: JSON.stringify({
            identificador: payload.identificador,
            plataforma: payload.plataforma,
            texto: payload.texto,
            fechaIncidente: new Date().toISOString(),
            ciudad: "Bogotá",
            pais: "Colombia",
        }),
        maxRetries: 1,
        baseDelayMs: 500,
    });
    const latencia = Date.now() - startMs;
    return { status: res.status, latencia };
}

async function ejecutarSimulacion(runId) {
    const repo = new SimulacionAbusoRepository();
    const run = await repo.findById(runId);
    if (!run) {
        console.error(`[SIMULADOR-ABUSO] Run ${runId} no encontrado`);
        return;
    }
    if (run.estado !== "PENDIENTE") {
        console.log(`[SIMULADOR-ABUSO] Run ${runId} estado=${run.estado}; se omite.`);
        return;
    }

    await repo.actualizar(runId, { estado: "EN_PROGRESO", fechaInicio: new Date() });

    const params = {
        escenario: run.escenario,
        n: run.n,
        ip: run.ipInyectada,
        identificador: run.identificador,
        plataforma: run.plataforma,
    };
    const payloads = generarPayloads(params);

    let enviados = 0;
    let bloqueados = 0;
    let spam = 0;
    let fallidos = 0;
    let latenciaTotal = 0;

    for (let i = 0; i < payloads.length; i++) {
        // Verificar cancelación antes de cada envío
        const actual = await repo.findById(runId);
        if (!actual || actual.estado === "CANCELADA") {
            console.log(`[SIMULADOR-ABUSO] Run ${runId} cancelado en ciclo ${i + 1}/${payloads.length}`);
            await repo.actualizar(runId, {
                estado: "CANCELADA",
                fechaFin: new Date(),
                totalEnviados: enviados,
                totalBloqueados: bloqueados,
                totalSpam: spam,
            });
            return;
        }

        const payload = payloads[i];
        try {
            const { status, latencia } = await enviarReporte(payload, payload.ip);
            latenciaTotal += latencia;
            if (status === 201) {
                enviados++;
            } else if (status === 429) {
                bloqueados++;
            } else if (status === 200 || status === 202) {
                // Tratado como aceptado
                enviados++;
            } else {
                fallidos++;
            }
            console.log(`[SIMULADOR-ABUSO] Run ${runId} ${i + 1}/${payloads.length} status=${status} latencia=${latencia}ms`);
        } catch (err) {
            fallidos++;
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[SIMULADOR-ABUSO] Run ${runId} ${i + 1}/${payloads.length} error=${msg}`);
        }

        // Pequeña pausa para no saturar Ollama/Mac del CEO
        if (i < payloads.length - 1) {
            await new Promise((r) => setTimeout(r, 200));
        }
    }

    const latenciaPromedio = enviados + bloqueados + fallidos > 0 ? Math.round(latenciaTotal / (enviados + bloqueados + fallidos)) : 0;
    const estadoFinal = fallidos > 0 && enviados === 0 ? "FALLIDA" : "COMPLETADA";

    await repo.actualizar(runId, {
        estado: estadoFinal,
        fechaFin: new Date(),
        totalEnviados: enviados,
        totalBloqueados: bloqueados,
        totalSpam: spam,
        latenciaPromedioMs: latenciaPromedio,
    });

    await logAudit({
        accion: "SIMULACION_ABUSO_COMPLETADA",
        tipoRecurso: "SimulacionAbusoRun",
        recursoId: runId,
        usuarioId: run.creadoPorId,
        valorNuevo: JSON.stringify({ estado: estadoFinal, enviados, bloqueados, spam, fallidos, latenciaPromedio }),
    });

    console.log(`[SIMULADOR-ABUSO] Run ${runId} finalizado: estado=${estadoFinal} enviados=${enviados} bloqueados=${bloqueados} fallidos=${fallidos} latenciaPromedio=${latenciaPromedio}ms`);
}

async function start() {
    await acquireAdvisoryLock();
    await ensureStarted();
    await ensureQueue("simulacion-abuso");

    console.log("[SIMULADOR-ABUSO] Iniciado. Escuchando cola 'simulacion-abuso'...");

    await boss.work("simulacion-abuso", { teamSize: 1, teamConcurrency: 1, batchSize: 1 }, async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        if (!job || !job.data) {
            console.error("[SIMULADOR-ABUSO] Job inválido:", JSON.stringify(jobs));
            return;
        }
        const { runId } = job.data;
        console.log(`[SIMULADOR-ABUSO] Job recibido runId=${runId}`);
        try {
            await ejecutarSimulacion(runId);
            return { success: true, runId };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[SIMULADOR-ABUSO] ERROR runId=${runId}: ${msg}`);
            try {
                await prisma.simulacionAbusoRun.update({
                    where: { id: runId },
                    data: { estado: "FALLIDA", fechaFin: new Date() },
                });
            } catch (markErr) {
                console.error(`[SIMULADOR-ABUSO] ERROR no se pudo marcar runId=${runId} como fallida:`, markErr);
            }
            throw err;
        }
    });
}

start().catch((err) => {
    console.error("[SIMULADOR-ABUSO] Fatal:", err.message);
    process.exit(1);
});
