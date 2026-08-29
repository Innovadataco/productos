import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { AnomaliaRepository } from "@/lib/dal/repositories/anomalia-repository";
import { resolverAnomalia } from "@/lib/analisis/anomalias/resolucion";

/**
 * SPEC-225 (US3, FR-013/FR-014): detalle y resolución de una anomalía (solo
 * ADMIN). GET devuelve el detalle con `datosContexto` (solo agregados);
 * PATCH marca la anomalía como resuelta, registra AuditLog y retorna 409 si
 * ya estaba resuelta. Contrato:
 * specs/225-deteccion-anomalias/contracts/anomalias-admin.md.
 */

const patchSchema = z.object({
    notaResolucion: z
        .string()
        .max(500, "notaResolucion no puede superar 500 caracteres")
        .optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await verifyAuth("ADMIN");
        const { id } = await params;

        const repo = new AnomaliaRepository();
        const anomalia = await repo.obtenerAnomalia(id);
        if (!anomalia) {
            throw new AppError("Anomalía no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        return NextResponse.json(anomalia);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/ANOMALIAS/ID]");
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        const { id } = await params;
        const body = await parseBody(request, patchSchema);

        const anomalia = await resolverAnomalia({
            id,
            notaResolucion: body.notaResolucion ?? null,
            adminId: admin.id,
            ipAddress:
                request.headers.get("x-forwarded-for") ??
                request.headers.get("x-real-ip") ??
                undefined,
            userAgent: request.headers.get("user-agent") ?? undefined,
        });

        return NextResponse.json(anomalia);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/ANOMALIAS/ID]");
    }
}
