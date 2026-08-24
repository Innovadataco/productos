/**
 * SPEC-226 (002-PI-mega-cola, FR-011): rollback manual de una acción automática.
 *
 * `revertirEjecucion` busca la `EjecucionAccion` EJECUTADA más reciente de la
 * recomendación y despacha el `revertir` del handler del tipo de acción, en
 * UNA transacción (efecto del rollback + marca REVERTIDA + AuditLog). Las
 * llamadas al Motor Notif de la reversión (desasignación, cancelación) van
 * post-TX, fail-open con log.
 *
 * Errores canónicos: 404 recomendación inexistente; 409 si no hay ejecución
 * revertible (inexistente, ya REVERTIDA o FALLIDA).
 */
import type { EjecucionAccion, TipoAccionEjecutable } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { EjecucionAccionRepository } from "@/lib/dal/repositories/ejecucion-accion";
import { obtenerHandlerPorTipo } from "./registry";

export interface EfectoReversion {
    tipo: TipoAccionEjecutable;
    detalle: string;
    [clave: string]: unknown;
}

export interface ResultadoReversion {
    ejecucion: EjecucionAccion;
    efectoReversion: EfectoReversion;
}

/** Ids de dominio conocidos que el contrato expone en `efectoReversion`. */
function extraerIdsEfecto(resultado: unknown): Record<string, unknown> {
    if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) return {};
    const obj = resultado as Record<string, unknown>;
    const ids: Record<string, unknown> = {};
    for (const clave of ["bonoId", "operadorId", "evento"] as const) {
        if (typeof obj[clave] === "string") ids[clave] = obj[clave];
    }
    return ids;
}

export async function revertirEjecucion(input: {
    recomendacionId: string;
    motivo: string;
    adminId: string;
}): Promise<ResultadoReversion> {
    const repo = new EjecucionAccionRepository();

    const recomendacion = await repo.obtenerRecomendacionConRegla(input.recomendacionId);
    if (!recomendacion) {
        throw new AppError("Recomendación no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    const ejecucion = await repo.buscarUltimaEjecutadaPorRecomendacion(recomendacion.id);
    if (!ejecucion) {
        throw new AppError(
            "No hay una ejecución revertible para esta recomendación",
            ERROR_CODES.CONFLICT,
            409
        );
    }
    const handler = obtenerHandlerPorTipo(ejecucion.tipoAccion);
    if (!handler) {
        throw new AppError(
            "No hay una ejecución revertible para esta recomendación",
            ERROR_CODES.CONFLICT,
            409
        );
    }

    const salida = await repo.ejecutarEnTransaccion(async (tx) => {
        const txRepo = new EjecucionAccionRepository(tx);
        const revertir = await handler.revertir({
            ejecucion,
            recomendacion,
            regla: recomendacion.regla,
            tx,
            repo: txRepo,
        });

        let actualizada = await txRepo.marcarRevertida(ejecucion.id, input.adminId, input.motivo);
        if (revertir.resultadoPatch) {
            actualizada = await txRepo.fusionarResultado(ejecucion.id, revertir.resultadoPatch);
        }

        await logAudit({
            accion: "ANALISIS_ACCION_REVERTIDA",
            tipoRecurso: "EjecucionAccion",
            recursoId: ejecucion.id,
            usuarioId: input.adminId,
            metadatos: {
                reglaId: recomendacion.regla.id,
                reglaClave: recomendacion.regla.clave,
                recomendacionId: recomendacion.id,
                tipoAccion: ejecucion.tipoAccion,
                motivoReversion: input.motivo,
            },
            tx,
        });

        return { ejecucion: actualizada, revertir };
    });

    // Post-TX: notificaciones de la reversión (fail-open con log).
    let detalle = salida.revertir.detalle;
    let ejecucionFinal = salida.ejecucion;
    if (salida.revertir.notificar) {
        try {
            const parcial = await salida.revertir.notificar();
            if (parcial) {
                if (parcial.detalle) detalle = parcial.detalle;
                if (parcial.resultadoPatch) {
                    ejecucionFinal = await repo.fusionarResultado(ejecucionFinal.id, parcial.resultadoPatch);
                }
            }
        } catch (error) {
            console.error(
                `[Analisis/Acciones] Error en notificar() de reversión (ejecución ${ejecucionFinal.id} queda REVERTIDA):`,
                error instanceof Error ? error.message : error
            );
        }
    }

    return {
        ejecucion: ejecucionFinal,
        efectoReversion: {
            tipo: ejecucionFinal.tipoAccion,
            detalle,
            ...extraerIdsEfecto(ejecucionFinal.resultado),
        },
    };
}
