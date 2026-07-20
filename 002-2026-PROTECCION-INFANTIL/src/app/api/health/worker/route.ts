import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES, safeErrorMessage } from "@/lib/errors";

const PID_FILE = resolve(process.cwd(), "worker.pid");

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
        if (existsSync(PID_FILE)) {
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
        console.error("[HEALTH-WORKER] Error:", error);
        return NextResponse.json(
            { status: "error", message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR, timestamp: new Date().toISOString() },
            { status: 503 }
        );
    }
}
