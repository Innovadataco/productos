import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEnv } from "@/lib/env";
import { ERROR_CODES } from "@/lib/errors";

export function validarWorkerSecret(request: Request): { ok: true } | { ok: false; response: NextResponse } {
    const secret = request.headers.get("x-worker-secret");
    if (secret !== requireEnv("WORKER_SECRET", 8)) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: { message: "Unauthorized", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            ),
        };
    }
    return { ok: true };
}

export async function parsearBody(request: Request): Promise<{ ok: true; reporteId: string; modeloClasificacion?: string } | { ok: false; response: NextResponse }> {
    try {
        const body = (await request.json()) as { reporteId?: string; modeloClasificacion?: string };
        if (!body.reporteId) {
            return {
                ok: false,
                response: NextResponse.json(
                    { error: { message: "reporteId requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                    { status: 400 }
                ),
            };
        }
        return { ok: true, reporteId: body.reporteId, modeloClasificacion: body.modeloClasificacion };
    } catch {
        return {
            ok: false,
            response: NextResponse.json(
                { error: { message: "Body inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            ),
        };
    }
}

import type { Reporte } from "@prisma/client";

export async function obtenerReporte(reporteId: string): Promise<{ ok: true; reporte: Reporte } | { ok: false; response: NextResponse }> {
    const reporte = await prisma.reporte.findUnique({ where: { id: reporteId } });
    if (!reporte) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            ),
        };
    }
    return { ok: true, reporte };
}
