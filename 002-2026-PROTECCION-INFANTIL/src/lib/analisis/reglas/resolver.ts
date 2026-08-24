/**
 * SPEC-221 (002-PI-122): servicio de resolución humana de recomendaciones.
 *
 * Única vía de transición manual: PENDIENTE → APLICADA | IGNORADA (EXPIRADA es
 * exclusiva del worker). Reglas de negocio:
 * - id inexistente → 404 NOT_FOUND.
 * - estado actual distinto de PENDIENTE → 409 CONFLICT (el estado no cambia).
 * - Toda resolución registra AuditLog (RECOMENDACION_RESUELTA) con metadatos
 *   mínimos (reglaId, categoria, estado): nunca datosContexto ni datos del sujeto.
 */
import type { Recomendacion } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ReglasRecomendacionRepository } from "@/lib/dal/repositories/reglas-recomendacion";

export type EstadoResolucion = "APLICADA" | "IGNORADA";

export async function resolverRecomendacion(params: {
    id: string;
    estado: EstadoResolucion;
    motivo: string | null;
    adminId: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}): Promise<Recomendacion> {
    const repo = new ReglasRecomendacionRepository();
    const recomendacion = await repo.obtenerRecomendacion(params.id);
    if (!recomendacion) {
        throw new AppError("Recomendación no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    if (recomendacion.estado !== "PENDIENTE") {
        throw new AppError("La recomendación ya fue resuelta", ERROR_CODES.CONFLICT, 409);
    }

    return repo.resolverRecomendacionConAuditoria({
        id: params.id,
        estado: params.estado,
        motivoResolucion: params.motivo,
        resueltaPorAdminId: params.adminId,
        audit: {
            usuarioId: params.adminId,
            metadatos: {
                reglaId: recomendacion.reglaId,
                categoria: recomendacion.categoria,
                estado: params.estado,
            },
            ipAddress: params.ipAddress ?? "unknown",
            userAgent: params.userAgent ?? "unknown",
        },
    });
}
