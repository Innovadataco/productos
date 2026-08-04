import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { verificarConexionDb } from "@/lib/dal/adapters/health";
import { existeHeartbeatWorker, leerHeartbeatWorker } from "@/lib/worker-heartbeat";

// Spec 097: en contenedores (app y worker separados) el PID no es visible entre
// procesos; el heartbeat en volumen compartido (WORKER_RUN_DIR) es la fuente de verdad.
// En dev (mismo host) se mantiene el chequeo de PID como fallback.
// SPEC-143: la lectura del heartbeat vive en @/lib/worker-heartbeat (la home del
// rector la reusa como "última revisión del sistema"); el comportamiento es idéntico.
const RUN_DIR = process.env.WORKER_RUN_DIR ?? process.cwd();
const PID_FILE = resolve(RUN_DIR, "worker.pid");
const HEARTBEAT_MAX_AGE_MS = 90_000;

function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

export async function GET() {
    try {
        // 1. Verificar que el worker esté corriendo
        let workerAlive = false;
        if (existeHeartbeatWorker()) {
            const heartbeat = leerHeartbeatWorker();
            workerAlive = heartbeat !== null && Date.now() - heartbeat.getTime() < HEARTBEAT_MAX_AGE_MS;
        } else if (existsSync(PID_FILE)) {
            const pid = parseInt(readFileSync(PID_FILE, "utf8").trim(), 10);
            if (!Number.isNaN(pid)) {
                workerAlive = isProcessAlive(pid);
            }
        }

        // 2. Verificar conexión a base de datos (E-8: el chequeo vive en el adaptador D3)
        const dbOk = await verificarConexionDb();

        const healthy = workerAlive && dbOk;

        return NextResponse.json(
            {
                status: healthy ? "ok" : "degraded",
                workerAlive,
                dbOk,
                timestamp: new Date().toISOString(),
            },
            { status: healthy ? 200 : 503 }
        );
    } catch (error) {
        logger.error("[HEALTH-WORKER] Error:", error);
        return NextResponse.json(
            { status: "error", message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR, timestamp: new Date().toISOString() },
            { status: 503 }
        );
    }
}
