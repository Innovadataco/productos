/**
 * SPEC-238 (002-PI-mega-cola): orquestación de la aclaración padre-comité
 * (1 iteración máx). Frontera DAL (Q-3): todo el acceso a BD pasa por los
 * repositorios; este servicio no importa `@/lib/prisma`.
 *
 * Flujo:
 * 1. El padre titular pide UNA aclaración (expediente EN_APROBACION_PADRE →
 *    EN_ACLARACION).
 * 2. El comité responde (EN_ACLARACION → EN_APROBACION_PADRE).
 * 3. El padre (o el worker post-SLA) cierra forzosamente (→ CERRADO).
 *
 * Desviación documentada respecto a FR-009 ("misma unidad de trabajo"):
 * `aplicarTransicion` (SPEC-236) no acepta un cliente transaccional — abre su
 * propia TX en `ExpedienteMotorRepository` — y sus guards leen la BD ya
 * confirmada (una aclaración sin commit sería invisible para el guard). Por
 * eso la escritura de la aclaración (+AuditLog) se confirma primero en SU
 * transacción y la transición del expediente corre después; si la transición
 * falla se aplica la compensación (eliminar la aclaración creada o revertir
 * la respuesta), de modo que nunca queda aclaración huérfana ni expediente
 * cambiado parcialmente (edge case de la spec).
 *
 * Los eventos `expediente.aclaracion.solicitada` y
 * `expediente.aclaracion.respondida` (FR-007) los publica `aplicarTransicion`
 * como evento de la transición (fail-open, post-commit).
 *
 * Auditoría: solo metadatos (ids y estados); NUNCA `solicitudTexto` ni
 * `respuestaTexto` (FR-008).
 */
import { EstadoExpediente } from "@prisma/client";
import type { AclaracionExpediente } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { withUnitOfWork } from "../unit-of-work";
import { ExpedienteMotorRepository } from "../repositories/expediente-motor-repository";
import { InformeConsolidadoRepository } from "../repositories/informe-consolidado-repository";
import {
    AclaracionRepository,
    ESTADO_ACLARACION,
    type AclaracionConExpediente,
    type EstadoAclaracion,
} from "../repositories/aclaracion-repository";
import { aplicarTransicion, type ActorTransicion } from "@/lib/expediente/estados/aplicar-transicion";

/** Motivo canónico del cierre forzoso por SLA de aclaración vencido (worker). */
export const MOTIVO_CIERRE_SLA_ACLARACION = "CIERRE_FORZOSO_SLA_ACLARACION";

const ACTOR_WORKER: ActorTransicion = { id: "worker-expediente-motor", tipo: "worker" };

export interface SolicitarAclaracionInput {
    expedienteId: string;
    padreUsuarioId: string;
    solicitudTexto: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export interface ResponderAclaracionInput {
    aclaracionId: string;
    comite: { id: string; comiteColegioId?: string | null | undefined };
    respuestaTexto: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export interface CerrarForzosoInput {
    expedienteId: string;
    actor: ActorTransicion;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export interface ResultadoCierreForzoso {
    expedienteId: string;
    estadoExpediente: EstadoExpediente;
    aclaracionEstado: EstadoAclaracion | null;
    /** true cuando el expediente ya estaba CERRADO (llamada idempotente). */
    yaCerrado: boolean;
}

/** Marca CERRADA_FORZOSAMENTE + AuditLog en UNA transacción (sin textos). */
async function marcarCerradaForzosamenteYAuditar(
    aclaracion: Pick<AclaracionExpediente, "id" | "expedienteId" | "informeConsolidadoId">,
    opciones: { usuarioId?: string | undefined; ipAddress?: string | undefined; userAgent?: string | undefined }
): Promise<void> {
    await withUnitOfWork(async (tx) => {
        const cambio = await new AclaracionRepository(tx).marcarCerradaForzosamente(aclaracion.id);
        if (!cambio) return;
        await logAudit({
            accion: "ACLARACION_CERRADA_FORZOSAMENTE",
            tipoRecurso: "AclaracionExpediente",
            recursoId: aclaracion.id,
            usuarioId: opciones.usuarioId,
            ipAddress: opciones.ipAddress,
            userAgent: opciones.userAgent,
            metadatos: {
                expedienteId: aclaracion.expedienteId,
                informeConsolidadoId: aclaracion.informeConsolidadoId,
                estado: ESTADO_ACLARACION.CERRADA_FORZOSAMENTE,
            },
            tx,
        });
    });
}

/**
 * US1: el padre titular pide la aclaración. Crea la fila PENDIENTE y transita
 * el expediente a EN_ACLARACION; si la transición falla, la aclaración se
 * elimina (compensación: no queda huérfana).
 */
export async function solicitarAclaracion(input: SolicitarAclaracionInput): Promise<AclaracionExpediente> {
    const expediente = await new ExpedienteMotorRepository().obtenerPorId(input.expedienteId);
    if (!expediente) {
        throw new AppError("Expediente no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    if (expediente.padreUsuarioId !== input.padreUsuarioId) {
        throw new AppError("Solo el padre titular puede pedir una aclaración", ERROR_CODES.FORBIDDEN, 403);
    }
    if (expediente.estado !== EstadoExpediente.EN_APROBACION_PADRE) {
        throw new AppError(
            "El expediente no está en aprobación del padre; no admite aclaraciones",
            ERROR_CODES.CONFLICT,
            409
        );
    }

    const existente = await new AclaracionRepository().findByExpedienteId(input.expedienteId);
    if (existente) {
        throw new AppError(
            "Ya existe una aclaración para este expediente (máximo una por expediente)",
            ERROR_CODES.CONFLICT,
            409
        );
    }

    const informe = await new InformeConsolidadoRepository().obtenerUltimaVersion(input.expedienteId);
    if (!informe) {
        throw new AppError(
            "No existe un informe consolidado para este expediente",
            ERROR_CODES.CONFLICT,
            409
        );
    }

    // TX 1: creación + auditoría (la restricción única resuelve carreras → 409).
    const aclaracion = await withUnitOfWork(async (tx) => {
        const creada = await new AclaracionRepository(tx).crear({
            expedienteId: input.expedienteId,
            informeConsolidadoId: informe.id,
            solicitudTexto: input.solicitudTexto,
        });
        await logAudit({
            accion: "ACLARACION_SOLICITADA",
            tipoRecurso: "AclaracionExpediente",
            recursoId: creada.id,
            usuarioId: input.padreUsuarioId,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            metadatos: {
                expedienteId: creada.expedienteId,
                informeConsolidadoId: creada.informeConsolidadoId,
                estado: creada.estado,
            },
            tx,
        });
        return creada;
    });

    // TX 2 (SPEC-236): transición del expediente. El evento
    // `expediente.aclaracion.solicitada` lo publica aplicarTransicion.
    try {
        await aplicarTransicion({
            expedienteId: input.expedienteId,
            estadoDestino: EstadoExpediente.EN_ACLARACION,
            motivo: "ACLARACION_SOLICITADA",
            actor: { id: input.padreUsuarioId, tipo: "usuario", rol: "PARENT" },
        });
    } catch (error) {
        // Compensación: no queda aclaración huérfana si la transición falla.
        await new AclaracionRepository().eliminar(aclaracion.id);
        throw error;
    }

    return aclaracion;
}

/**
 * US2: el comité responde. La aclaración pasa a RESPONDIDA y el expediente
 * vuelve a EN_APROBACION_PADRE; si la transición falla, la respuesta se
 * revierte a PENDIENTE (compensación).
 */
export async function responderAclaracion(input: ResponderAclaracionInput): Promise<AclaracionExpediente> {
    const aclaracion = await new AclaracionRepository().findById(input.aclaracionId);
    if (!aclaracion) {
        throw new AppError("Aclaración no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    // Un comité con cuenta de colegio (SPEC-168) no tiene ámbito sobre
    // expedientes de padre (cross-tenant por diseño): 404, no 403, para no
    // revelar la existencia de la aclaración.
    if (input.comite.comiteColegioId) {
        throw new AppError("Aclaración no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    if (aclaracion.estado !== ESTADO_ACLARACION.PENDIENTE) {
        throw new AppError(
            "La aclaración no está pendiente de respuesta",
            ERROR_CODES.CONFLICT,
            409
        );
    }

    // TX 1: respuesta + auditoría (UPDATE condicional serializa carreras → 409).
    const respondida = await withUnitOfWork(async (tx) => {
        const actualizada = await new AclaracionRepository(tx).responder(
            input.aclaracionId,
            input.comite.id,
            input.respuestaTexto
        );
        await logAudit({
            accion: "ACLARACION_RESPONDIDA",
            tipoRecurso: "AclaracionExpediente",
            recursoId: actualizada.id,
            usuarioId: input.comite.id,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            metadatos: {
                expedienteId: actualizada.expedienteId,
                informeConsolidadoId: actualizada.informeConsolidadoId,
                estado: actualizada.estado,
            },
            tx,
        });
        return actualizada;
    });

    // TX 2 (SPEC-236): el evento `expediente.aclaracion.respondida` lo publica
    // aplicarTransicion.
    try {
        await aplicarTransicion({
            expedienteId: aclaracion.expedienteId,
            estadoDestino: EstadoExpediente.EN_APROBACION_PADRE,
            motivo: "ACLARACION_RESPONDIDA",
            actor: { id: input.comite.id, tipo: "usuario", rol: "COMITE_VALIDACION" },
        });
    } catch (error) {
        await new AclaracionRepository().revertirAPendiente(aclaracion.id);
        throw error;
    }

    return respondida;
}

/**
 * US3: cierre forzoso del expediente (padre titular o worker post-SLA).
 * Idempotente (D-5): si el expediente ya está CERRADO devuelve 200 sin
 * cambios, completando la marca de la aclaración si quedó a medias.
 */
export async function cerrarForzosamente(input: CerrarForzosoInput): Promise<ResultadoCierreForzoso> {
    const expediente = await new ExpedienteMotorRepository().obtenerPorId(input.expedienteId);
    if (!expediente) {
        throw new AppError("Expediente no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    if (input.actor.tipo === "usuario" && expediente.padreUsuarioId !== input.actor.id) {
        throw new AppError("Solo el padre titular puede cerrar el expediente", ERROR_CODES.FORBIDDEN, 403);
    }

    const aclaracion = await new AclaracionRepository().findByExpedienteId(input.expedienteId);

    if (expediente.estado === EstadoExpediente.CERRADO) {
        if (aclaracion && aclaracion.estado === ESTADO_ACLARACION.RESPONDIDA) {
            await marcarCerradaForzosamenteYAuditar(aclaracion, {
                usuarioId: input.actor.tipo === "usuario" ? input.actor.id : undefined,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
            });
        }
        return {
            expedienteId: input.expedienteId,
            estadoExpediente: EstadoExpediente.CERRADO,
            aclaracionEstado: aclaracion ? ESTADO_ACLARACION.CERRADA_FORZOSAMENTE : null,
            yaCerrado: true,
        };
    }

    if (expediente.estado !== EstadoExpediente.EN_APROBACION_PADRE) {
        throw new AppError(
            "El expediente no está en aprobación del padre; no admite cierre forzoso",
            ERROR_CODES.CONFLICT,
            409
        );
    }
    if (
        !aclaracion ||
        (aclaracion.estado !== ESTADO_ACLARACION.RESPONDIDA &&
            aclaracion.estado !== ESTADO_ACLARACION.CERRADA_FORZOSAMENTE)
    ) {
        throw new AppError(
            "El cierre forzoso requiere una aclaración respondida o cerrada forzosamente",
            ERROR_CODES.CONFLICT,
            409
        );
    }

    // La transición va primero: el guard de SPEC-236 exige la aclaración aún
    // en RESPONDIDA (o al padre titular como actor).
    await aplicarTransicion({
        expedienteId: input.expedienteId,
        estadoDestino: EstadoExpediente.CERRADO,
        motivo: MOTIVO_CIERRE_SLA_ACLARACION,
        actor: input.actor,
    });

    if (aclaracion.estado === ESTADO_ACLARACION.RESPONDIDA) {
        await marcarCerradaForzosamenteYAuditar(aclaracion, {
            usuarioId: input.actor.tipo === "usuario" ? input.actor.id : undefined,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
    }

    return {
        expedienteId: input.expedienteId,
        estadoExpediente: EstadoExpediente.CERRADO,
        aclaracionEstado: ESTADO_ACLARACION.CERRADA_FORZOSAMENTE,
        yaCerrado: false,
    };
}

/**
 * US4: cierre forzoso ejecutado por el worker cuando la aclaración PENDIENTE
 * superó el SLA del comité. Transita EN_ACLARACION → CERRADO (guard
 * worker-only de SPEC-238) y marca la aclaración CERRADA_FORZOSAMENTE.
 * Idempotente: si el expediente ya quedó CERRADO, solo completa la marca.
 */
export async function cerrarAclaracionVencidaPorSla(aclaracion: AclaracionConExpediente): Promise<void> {
    if (aclaracion.expediente.estado === EstadoExpediente.EN_ACLARACION) {
        try {
            await aplicarTransicion({
                expedienteId: aclaracion.expedienteId,
                estadoDestino: EstadoExpediente.CERRADO,
                motivo: MOTIVO_CIERRE_SLA_ACLARACION,
                actor: ACTOR_WORKER,
            });
        } catch (error) {
            // Si otra instancia ya cerró el expediente, se completa la marca igualmente.
            const actual = await new ExpedienteMotorRepository().obtenerPorId(aclaracion.expedienteId);
            if (actual?.estado !== EstadoExpediente.CERRADO) throw error;
        }
    }
    await marcarCerradaForzosamenteYAuditar(aclaracion, {
        ipAddress: "worker",
        userAgent: "expediente-motor/worker",
    });
}

/**
 * Detalle completo de la aclaración para la UI del comité (T021). Incluye
 * `solicitudTexto` y `respuestaTexto`: el comité de validación es el actor
 * autorizado para leerlos y responder (D-7). Una cuenta de comité con ámbito
 * de colegio recibe 404 (el expediente de padre es cross-tenant por diseño).
 */
export async function obtenerDetalleAclaracionParaComite(
    aclaracionId: string,
    comite: { comiteColegioId?: string | null | undefined }
): Promise<AclaracionConExpediente> {
    const aclaracion = await new AclaracionRepository().findById(aclaracionId);
    if (!aclaracion) {
        throw new AppError("Aclaración no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    if (comite.comiteColegioId) {
        throw new AppError("Aclaración no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    return aclaracion;
}
