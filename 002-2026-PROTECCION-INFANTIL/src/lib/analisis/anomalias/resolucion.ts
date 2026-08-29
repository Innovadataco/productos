/**
 * SPEC-225 (US3, FR-014): resolución humana de una anomalía detectada.
 * Marca `resueltaEn`/`resueltaPorAdminId`, conserva la nota opcional con
 * merge ADITIVO en `datosContexto.notaResolucion` (H-8 de tasks.md) y
 * registra AuditLog (acción `ANOMALIA_RESUELTA`, solo metadatos, sin PII).
 * v1 no auto-resuelve: esta es la única vía de cierre (research §3.3).
 */
import type { Prisma } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { AnomaliaRepository } from "@/lib/dal/repositories/anomalia-repository";

export interface ResolverAnomaliaInput {
    id: string;
    notaResolucion: string | null;
    adminId: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export async function resolverAnomalia(input: ResolverAnomaliaInput) {
    const repo = new AnomaliaRepository();
    const anomalia = await repo.obtenerAnomalia(input.id);
    if (!anomalia) {
        throw new AppError("Anomalía no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    if (anomalia.resueltaEn !== null) {
        throw new AppError("La anomalía ya fue resuelta", ERROR_CODES.CONFLICT, 409);
    }

    const datosContexto = input.notaResolucion
        ? {
            ...(anomalia.datosContexto as Record<string, unknown>),
            notaResolucion: input.notaResolucion,
        }
        : (anomalia.datosContexto as Record<string, unknown>);

    const actualizada = await repo.marcarResuelta(
        anomalia.id,
        input.adminId,
        datosContexto as Prisma.InputJsonValue
    );

    await logAudit({
        accion: "ANOMALIA_RESUELTA",
        tipoRecurso: "Anomalia",
        recursoId: anomalia.id,
        usuarioId: input.adminId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadatos: { tipo: anomalia.tipo, severidad: anomalia.severidad },
    });

    return actualizada;
}
