/**
 * SPEC-221 (002-PI-122): repositorio DAL del motor de reglas de recomendación.
 * Aísla TODO el acceso a Prisma del dominio (frontera Q-3): el motor
 * (`src/lib/analisis/reglas/`), el worker y el endpoint de resolución consumen
 * esta clase; fuera de aquí nadie importa `@/lib/prisma` para este dominio.
 *
 * Incluye el ejecutor SQL sandboxed: la validación estática vive en
 * `src/lib/analisis/reglas/ejecutor-sql.ts` (pura) y la ejecución real aquí,
 * en transacción `READ ONLY` con `statement_timeout` acotado. Las queries de
 * las reglas solo leen el dominio SaaS/análisis; nunca texto de reportes ni
 * campos cifrados (convención dura de la spec).
 */
import type { Prisma, Recomendacion, ReglaRecomendacion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

/** Fila cruda devuelta por la query de detección de una regla. */
export type FilaCandidata = Record<string, unknown>;

/** Datos de escritura para actualizar una recomendación PENDIENTE (dedup). */
export interface ActualizacionRecomendacion {
    titulo: string;
    descripcion: string;
    prioridad: number;
    datosContexto: Prisma.InputJsonValue;
    accionSugerida: string | null;
    accionParametros: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    expiraEn: Date;
}

/** Datos de creación de una recomendación nueva. */
export interface CreacionRecomendacion extends ActualizacionRecomendacion {
    reglaId: string;
    categoria: string;
    sujetoTipo: string | null;
    sujetoId: string | null;
}

export class ReglasRecomendacionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    obtenerRegla(reglaId: string): Promise<ReglaRecomendacion | null> {
        return this.db.reglaRecomendacion.findUnique({ where: { id: reglaId } });
    }

    /** Reglas activas; la cadencia (`frecuenciaMin`/`ultimaEvaluacionEn`) la aplica el motor. */
    listarReglasActivas(): Promise<ReglaRecomendacion[]> {
        return this.db.reglaRecomendacion.findMany({
            where: { activa: true },
            orderBy: { prioridad: "desc" },
        });
    }

    /**
     * Ejecuta la query de detección en una transacción de solo lectura con
     * `statement_timeout` acotado. `timeoutMs` se valida como entero antes de
     * interpolarlo en el SET (nunca texto libre). Aunque la validación estática
     * falle, PostgreSQL rechaza cualquier escritura (defensa en profundidad).
     */
    async ejecutarQuerySoloLectura(sql: string, timeoutMs: number): Promise<FilaCandidata[]> {
        const timeout = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(60000, Math.floor(timeoutMs))) : 5000;
        const filas = await prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
            await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${timeout}`);
            return tx.$queryRawUnsafe(sql);
        });
        return filas as FilaCandidata[];
    }

    /** Recomendación PENDIENTE de una regla para un sujeto concreto (dedup). */
    buscarPendientePorSujeto(reglaId: string, sujetoId: string): Promise<Recomendacion | null> {
        return this.db.recomendacion.findFirst({
            where: { reglaId, sujetoId, estado: "PENDIENTE" },
            orderBy: { generadaEn: "desc" },
        });
    }

    /** Recomendación PENDIENTE sin sujeto, identificada por `dedupKey` en datosContexto. */
    buscarPendientePorDedupKey(reglaId: string, dedupKey: string): Promise<Recomendacion | null> {
        return this.db.recomendacion.findFirst({
            where: {
                reglaId,
                sujetoId: null,
                estado: "PENDIENTE",
                datosContexto: { path: ["dedupKey"], equals: dedupKey },
            },
            orderBy: { generadaEn: "desc" },
        });
    }

    crearRecomendacion(data: CreacionRecomendacion): Promise<Recomendacion> {
        return this.db.recomendacion.create({ data });
    }

    actualizarRecomendacionPendiente(id: string, data: ActualizacionRecomendacion): Promise<Recomendacion> {
        return this.db.recomendacion.update({ where: { id }, data });
    }

    /** Marca la última corrida del motor sobre la regla (cadencia por frecuenciaMin). */
    async marcarReglaEvaluada(reglaId: string, cuando: Date): Promise<void> {
        await this.db.reglaRecomendacion.update({
            where: { id: reglaId },
            data: { ultimaEvaluacionEn: cuando },
        });
    }

    /**
     * Expiración idempotente: marca EXPIRADA toda recomendación PENDIENTE con
     * `expiraEn` vencido (FR-008). Devuelve el conteo de filas marcadas.
     */
    async expirarVencidas(ahora: Date): Promise<number> {
        const resultado = await this.db.recomendacion.updateMany({
            where: { estado: "PENDIENTE", expiraEn: { lt: ahora } },
            data: {
                estado: "EXPIRADA",
                resueltaEn: ahora,
                motivoResolucion: "EXPIRACION_AUTOMATICA",
            },
        });
        return resultado.count;
    }

    obtenerRecomendacion(id: string): Promise<Recomendacion | null> {
        return this.db.recomendacion.findUnique({ where: { id } });
    }

    /**
     * Resolución humana en UNA transacción: transición de estado + AuditLog
     * (`RECOMENDACION_RESUELTA`). Los metadatos de auditoría llegan armados por
     * el servicio (nunca datosContexto ni datos del sujeto).
     */
    async resolverRecomendacionConAuditoria(params: {
        id: string;
        estado: "APLICADA" | "IGNORADA";
        motivoResolucion: string | null;
        resueltaPorAdminId: string;
        audit: {
            usuarioId: string;
            metadatos: Record<string, unknown>;
            ipAddress: string;
            userAgent: string;
        };
    }): Promise<Recomendacion> {
        return prisma.$transaction(async (tx) => {
            const actualizada = await tx.recomendacion.update({
                where: { id: params.id },
                data: {
                    estado: params.estado,
                    resueltaEn: new Date(),
                    resueltaPorAdminId: params.resueltaPorAdminId,
                    motivoResolucion: params.motivoResolucion,
                },
            });
            await tx.auditLog.create({
                data: {
                    accion: "RECOMENDACION_RESUELTA",
                    tipoRecurso: "Recomendacion",
                    recursoId: params.id,
                    usuarioId: params.audit.usuarioId,
                    metadatos: params.audit.metadatos as Prisma.InputJsonValue,
                    ipAddress: params.audit.ipAddress,
                    userAgent: params.audit.userAgent,
                },
            });
            return actualizada;
        });
    }
}
