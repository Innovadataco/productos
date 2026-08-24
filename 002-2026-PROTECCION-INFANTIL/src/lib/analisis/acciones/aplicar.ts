/**
 * SPEC-226 (002-PI-mega-cola, FR-010): aplicación manual de una sugerencia
 * PENDIENTE por un admin.
 *
 * - Si la recomendación tiene acción ejecutable (regla.accionEjecutable ??
 *   accionSugerida), se ejecuta por el MISMO ejecutor de las reglas EJECUTA
 *   (misma trazabilidad y mismo rate-limit por regla) con origen MANUAL_ADMIN;
 *   el ejecutor la marca APLICADA con `resueltaPorAdminId`.
 * - Si no tiene acción ejecutable (sugerencia de contacto, ej. "llamar"), se
 *   marca APLICADA directamente con la auditoría de resolución existente y la
 *   respuesta trae `ejecucion: null`.
 *
 * Errores canónicos: 404 inexistente; 409 si no está PENDIENTE.
 */
import type { EjecucionAccion, Recomendacion } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { EjecucionAccionRepository } from "@/lib/dal/repositories/ejecucion-accion";
import { ReglasRecomendacionRepository } from "@/lib/dal/repositories/reglas-recomendacion";
import { obtenerHandlerPorClave } from "./registry";
import { ejecutarAccion } from "./ejecutor";

export interface ResultadoAplicacion {
    recomendacion: Recomendacion;
    ejecucion: EjecucionAccion | null;
}

export async function aplicarRecomendacion(input: {
    id: string;
    adminId: string;
}): Promise<ResultadoAplicacion> {
    const repo = new EjecucionAccionRepository();
    const recomendacion = await repo.obtenerRecomendacionConRegla(input.id);
    if (!recomendacion) {
        throw new AppError("Recomendación no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    if (recomendacion.estado !== "PENDIENTE") {
        throw new AppError("La recomendación no está pendiente", ERROR_CODES.CONFLICT, 409);
    }

    const clave = recomendacion.regla.accionEjecutable ?? recomendacion.accionSugerida;
    const handler = obtenerHandlerPorClave(clave);

    if (!handler) {
        // Sugerencia sin acción ejecutable: resolución manual directa.
        const actualizada = await new ReglasRecomendacionRepository().resolverRecomendacionConAuditoria({
            id: recomendacion.id,
            estado: "APLICADA",
            motivoResolucion: "APLICACION_MANUAL_SIN_ACCION",
            resueltaPorAdminId: input.adminId,
            audit: {
                usuarioId: input.adminId,
                metadatos: {
                    reglaId: recomendacion.reglaId,
                    categoria: recomendacion.categoria,
                    estado: "APLICADA",
                },
                ipAddress: "unknown",
                userAgent: "unknown",
            },
        });
        return { recomendacion: actualizada, ejecucion: null };
    }

    const ejecucion = await ejecutarAccion({
        recomendacionId: recomendacion.id,
        origen: "MANUAL_ADMIN",
        adminId: input.adminId,
    });
    const actualizada = await repo.obtenerRecomendacionConRegla(recomendacion.id);
    if (!actualizada) {
        throw new AppError("Recomendación no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    const { regla: _regla, ...plana } = actualizada;
    return { recomendacion: plana, ejecucion };
}
