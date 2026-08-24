/**
 * SPEC-236 (002-PI-mega-cola): aplicador de transiciones de estado del
 * expediente padre (FR-002).
 *
 * Flujo:
 * 1. Carga el expediente (bloqueo de fila vía update de updatedAt dentro de la TX).
 * 2. Hard guard: CERRADO → * se rechaza con 403 salvo CERRADO → ESCALADO (FR-010).
 * 3. Whitelist: par (actual → destino) no declarado → 409.
 * 4. Guard de negocio: falla → AppError con su código canónico.
 * 5. TX Prisma: actualiza estado (+ fechaCierre / autoCerradoPorInactividad /
 *    fechaEscalado según destino) y registra AuditLog.
 * 6. Tras el commit, publica el evento de Motor Notif (fail-open).
 *
 * Desviación documentada respecto al plan §3.1(5b): NO se inserta un
 * `EventoExpediente` por transición — ese agregado incrementa `numEventos`
 * (insumó del guard de consolidación) y rechaza expedientes cerrados. El
 * motivo y el actor quedan en `AuditLog.metadatos`.
 */
import { EstadoExpediente } from "@prisma/client";
import type { Expediente, Prisma } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ExpedienteMotorRepository } from "@/lib/dal/repositories/expediente-motor-repository";
import { buscarTransicion, type ActorTransicion } from "./transiciones";
import { publicarEventoExpediente } from "./publicar-evento-expediente";

export type { ActorTransicion } from "./transiciones";

/** Motivo canónico del auto-cierre por inactividad ejecutado por el worker. */
export const MOTIVO_AUTO_CIERRE_INACTIVIDAD = "AUTO_CIERRE_INACTIVIDAD";

export interface AplicarTransicionInput {
    expedienteId: string;
    estadoDestino: EstadoExpediente;
    motivo?: string | undefined;
    actor?: ActorTransicion | undefined;
}

const ACTOR_SISTEMA: ActorTransicion = { id: "sistema", tipo: "service-account" };

export async function aplicarTransicion(input: AplicarTransicionInput): Promise<Expediente> {
    const actor = input.actor ?? ACTOR_SISTEMA;

    const expediente = await new ExpedienteMotorRepository().obtenerPorId(input.expedienteId);
    if (!expediente) {
        throw new AppError("Expediente no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }

    const estadoActual = expediente.estado;

    // Hard guard §8: un expediente cerrado es terminal salvo reapertura v1.
    if (estadoActual === EstadoExpediente.CERRADO && input.estadoDestino !== EstadoExpediente.ESCALADO) {
        throw new AppError(
            "Un expediente cerrado no admite más transiciones (excepto reapertura a ESCALADO por el padre)",
            ERROR_CODES.FORBIDDEN,
            403
        );
    }

    const transicion = buscarTransicion(estadoActual, input.estadoDestino);
    if (!transicion) {
        throw new AppError(
            `Transición no permitida: ${estadoActual} → ${input.estadoDestino}`,
            ERROR_CODES.CONFLICT,
            409
        );
    }

    const guardResult = await transicion.guard({
        expediente,
        actor,
        motivo: input.motivo,
    });
    if (!guardResult.ok) {
        throw new AppError(
            guardResult.mensaje,
            guardResult.codigo === 403 ? ERROR_CODES.FORBIDDEN : ERROR_CODES.CONFLICT,
            guardResult.codigo
        );
    }

    const ahora = new Date();
    const data: Prisma.ExpedienteUpdateInput = {
        estado: input.estadoDestino,
        ...(input.estadoDestino === EstadoExpediente.CERRADO
            ? {
                fechaCierre: ahora,
                autoCerradoPorInactividad: input.motivo === MOTIVO_AUTO_CIERRE_INACTIVIDAD,
            }
            : {}),
        ...(input.estadoDestino === EstadoExpediente.ESCALADO ? { fechaEscalado: ahora } : {}),
    };

    const expedienteActualizado = await new ExpedienteMotorRepository().transicionarEstado({
        expedienteId: expediente.id,
        ahora,
        data,
        audit: {
            accion: "EXPEDIENTE_TRANSICION_ESTADO",
            tipoRecurso: "Expediente",
            recursoId: expediente.id,
            usuarioId: actor.tipo === "usuario" ? actor.id : undefined,
            valorAnterior: estadoActual,
            valorNuevo: input.estadoDestino,
            ipAddress: actor.tipo === "worker" ? "worker" : "unknown",
            userAgent: `expediente-motor/${actor.tipo}`,
            metadatos: {
                estadoAnterior: estadoActual,
                estadoDestino: input.estadoDestino,
                actorId: actor.id,
                actorTipo: actor.tipo,
                motivo: input.motivo ?? null,
            },
        },
    });

    // Fail-open: la notificación nunca revierte la transición ya aplicada.
    await publicarEventoExpediente(transicion.evento, {
        expediente: expedienteActualizado,
        estadoAnterior: estadoActual,
        estadoDestino: input.estadoDestino,
        actor: actor.id,
        motivo: input.motivo,
    });

    return expedienteActualizado;
}
