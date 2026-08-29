/**
 * SPEC-238 (002-PI-mega-cola): repositorio DAL del agregado
 * AclaracionExpediente (aclaración padre-comité, 1 iteración máx).
 *
 * Frontera DAL (Q-3): TODO el acceso a Prisma de la aclaración pasa por aquí;
 * los servicios de src/lib/expediente/ y las API Routes no importan
 * `@/lib/prisma`. Acepta un cliente transaccional opcional (D2).
 *
 * Invariantes:
 * - Máxima UNA aclaración por expediente (`@@unique([expedienteId])`); una
 *   carrera concurrente termina en P2002 → 409 Conflict.
 * - NUNCA se loguean `solicitudTexto` ni `respuestaTexto` (datos sensibles).
 */
import { Prisma } from "@prisma/client";
import type { AclaracionExpediente, Expediente } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";

/** Estados del ciclo de vida de la aclaración (campo String según brief §7.4). */
export type EstadoAclaracion = "PENDIENTE" | "RESPONDIDA" | "CERRADA_FORZOSAMENTE";

export const ESTADO_ACLARACION = {
    PENDIENTE: "PENDIENTE",
    RESPONDIDA: "RESPONDIDA",
    CERRADA_FORZOSAMENTE: "CERRADA_FORZOSAMENTE",
} as const satisfies Record<string, EstadoAclaracion>;

export type AclaracionConExpediente = AclaracionExpediente & {
    expediente: Pick<Expediente, "id" | "estado" | "padreUsuarioId">;
};

const EXPEDIENTE_SELECT = {
    id: true,
    estado: true,
    padreUsuarioId: true,
} as const;

export interface CrearAclaracionInput {
    expedienteId: string;
    informeConsolidadoId: string;
    solicitudTexto: string;
}

export class AclaracionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Aclaración por id, con el expediente (autorización y transiciones). */
    findById(id: string): Promise<AclaracionConExpediente | null> {
        return this.db.aclaracionExpediente.findUnique({
            where: { id },
            include: { expediente: { select: EXPEDIENTE_SELECT } },
        });
    }

    /** Aclaración única del expediente (relación 1:1 garantizada por BD). */
    findByExpedienteId(expedienteId: string): Promise<AclaracionExpediente | null> {
        return this.db.aclaracionExpediente.findUnique({ where: { expedienteId } });
    }

    /**
     * Crea la aclaración en estado PENDIENTE. La restricción única por
     * expediente convierte la carrera concurrente en 409 (P2002).
     */
    async crear(data: CrearAclaracionInput): Promise<AclaracionExpediente> {
        try {
            return await this.db.aclaracionExpediente.create({
                data: {
                    expedienteId: data.expedienteId,
                    informeConsolidadoId: data.informeConsolidadoId,
                    solicitudTexto: data.solicitudTexto,
                    estado: ESTADO_ACLARACION.PENDIENTE,
                },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                throw new AppError(
                    "Ya existe una aclaración para este expediente (máximo una por expediente)",
                    ERROR_CODES.CONFLICT,
                    409
                );
            }
            throw error;
        }
    }

    /**
     * Marca la aclaración como RESPONDIDA de forma atómica: el UPDATE
     * condicional (`estado: PENDIENTE`) serializa respuestas simultáneas; el
     * perdedor recibe 409. Devuelve la fila actualizada.
     */
    async responder(id: string, respondidaPor: string, respuestaTexto: string): Promise<AclaracionExpediente> {
        const resultado = await this.db.aclaracionExpediente.updateMany({
            where: { id, estado: ESTADO_ACLARACION.PENDIENTE },
            data: {
                estado: ESTADO_ACLARACION.RESPONDIDA,
                respondidaPor,
                respuestaTexto,
                respondidaEn: new Date(),
            },
        });
        if (resultado.count === 0) {
            throw new AppError(
                "La aclaración no está pendiente de respuesta",
                ERROR_CODES.CONFLICT,
                409
            );
        }
        const actualizada = await this.db.aclaracionExpediente.findUnique({ where: { id } });
        if (!actualizada) {
            throw new AppError("Aclaración no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        return actualizada;
    }

    /**
     * Marca la aclaración como CERRADA_FORZOSAMENTE. Idempotente: una fila ya
     * cerrada forzosamente no cuenta como cambio ni falla. Devuelve true si
     * esta llamada aplicó el cambio.
     */
    async marcarCerradaForzosamente(id: string): Promise<boolean> {
        const resultado = await this.db.aclaracionExpediente.updateMany({
            where: {
                id,
                estado: { in: [ESTADO_ACLARACION.PENDIENTE, ESTADO_ACLARACION.RESPONDIDA] },
            },
            data: { estado: ESTADO_ACLARACION.CERRADA_FORZOSAMENTE },
        });
        return resultado.count > 0;
    }

    /**
     * Compensación de `responder`: revierte a PENDIENTE cuando la transición
     * del expediente falló después de guardar la respuesta (no queda
     * aclaración respondida sin expediente en EN_APROBACION_PADRE).
     */
    async revertirAPendiente(id: string): Promise<void> {
        await this.db.aclaracionExpediente.updateMany({
            where: { id, estado: ESTADO_ACLARACION.RESPONDIDA },
            data: {
                estado: ESTADO_ACLARACION.PENDIENTE,
                respondidaPor: null,
                respuestaTexto: null,
                respondidaEn: null,
            },
        });
    }

    /**
     * Compensación de `crear`: elimina la aclaración cuando la transición del
     * expediente falló después de crearla (no queda aclaración huérfana).
     */
    async eliminar(id: string): Promise<void> {
        await this.db.aclaracionExpediente.deleteMany({ where: { id } });
    }

    /** Conteo por expediente y estado (guards de la máquina de estados, SPEC-236). */
    contarPorExpedienteYEstado(expedienteId: string, estado: EstadoAclaracion): Promise<number> {
        return this.db.aclaracionExpediente.count({ where: { expedienteId, estado } });
    }

    /**
     * Aclaraciones PENDIENTE cuya `solicitadaEn` es anterior a `limite`
     * (barrido del worker: SLA vencido). Incluye el expediente para la
     * transición y la publicación del evento.
     */
    listarPendientesVencidas(limite: Date, take = 100): Promise<AclaracionConExpediente[]> {
        const where: Prisma.AclaracionExpedienteWhereInput = {
            estado: ESTADO_ACLARACION.PENDIENTE,
            solicitadaEn: { lt: limite },
        };
        return this.db.aclaracionExpediente.findMany({
            where,
            orderBy: { solicitadaEn: "asc" },
            include: { expediente: { select: EXPEDIENTE_SELECT } },
            take,
        });
    }
}
