import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES } from "@/lib/errors";
import { procesarReporteSchema } from "@/lib/validators";

export async function parsearBody(request: Request): Promise<{ ok: true; reporteId: string; modeloClasificacion?: string } | { ok: false; response: NextResponse }> {
    // SPEC-125: esquema Zod compartido (validators.ts); los mensajes son el
    // contrato del worker (scripts/worker-reportes.mjs).
    const bodyRaw = await request.json().catch(() => undefined);
    const parsed = procesarReporteSchema.safeParse(bodyRaw);
    if (!parsed.success) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: { message: bodyRaw === undefined ? "Body inválido" : "reporteId requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            ),
        };
    }
    return { ok: true, reporteId: parsed.data.reporteId, modeloClasificacion: parsed.data.modeloClasificacion };
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
