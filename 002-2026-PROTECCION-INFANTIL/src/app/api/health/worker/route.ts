import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES, safeErrorMessage } from "@/lib/errors";

// Spec 097: en contenedores (app y worker separados) el PID no es visible entre
// procesos; el heartbeat en volumen compartido (WORKER_RUN_DIR) es la fuente de verdad.
// En dev (mismo host) se mantiene el chequeo de PID como fallback.
const RUN_DIR = process.env.WORKER_RUN_DIR ?? process.cwd();
const PID_FILE = resolve(RUN_DIR, "worker.pid");
const HEARTBEAT_FILE = resolve(RUN_DIR, "worker.heartbeat");
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
        if (existsSync(HEARTBEAT_FILE)) {
            const ts = parseInt(readFileSync(HEARTBEAT_FILE, "utf8").trim(), 10);
            workerAlive = !Number.isNaN(ts) && Date.now() - ts < HEARTBEAT_MAX_AGE_MS;
        } else if (existsSync(PID_FILE)) {
            const pid = parseInt(readFileSync(PID_FILE, "utf8").trim(), 10);
            if (!Number.isNaN(pid)) {
                workerAlive = isProcessAlive(pid);
            }
        }

        // 2. Verificar conexión a base de datos
        let dbOk = false;
        try {
            await prisma.$queryRaw`SELECT 1`;
            dbOk = true;
        } catch {
            dbOk = false;
        }

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
