/**
 * SPEC-053 (US3, módulo Estadísticas): repositorio de AuditLog para agregación
 * operativa (tiempos de gestión, casos por operador). Acepta tx opcional (D2).
 */
import type { AccionAudit, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class AuditLogRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    countAcciones(acciones: AccionAudit[], rango: { gte: Date; lte: Date }) {
        return this.db.auditLog.count({
            where: { accion: { in: acciones }, creadoEn: rango },
        });
    }

    /** Cierres de casos en el rango (para tiempo de gestión). */
    findCierres(acciones: AccionAudit[], rango: { gte: Date; lte: Date }) {
        return this.db.auditLog.findMany({
            where: { accion: { in: acciones }, creadoEn: rango, recursoId: { not: null } },
            select: { recursoId: true, creadoEn: true },
        });
    }

    /** Asignaciones de un conjunto de casos (primera por recurso la deduce el servicio). */
    findAsignaciones(recursoIds: string[], usuarioId?: string) {
        return this.db.auditLog.findMany({
            where: { accion: "OPERADOR_ASIGNADO", recursoId: { in: recursoIds }, ...(usuarioId ? { usuarioId } : {}) },
            select: { recursoId: true, creadoEn: true },
            orderBy: { creadoEn: "asc" },
        });
    }

    /**
     * SPEC-159 (FR-003): hitos de un recurso (p. ej. COLEGIO_ALERTA_ESTADO de
     * una alerta) con su fecha real y valor nuevo, asc — fuente de los hitos
     * "vista"/"gestionada" de la línea de tiempo del caso. Solo verdades: un
     * hito sin fila de audit queda pendiente, nunca inventado.
     */
    hitosPorRecurso(acciones: AccionAudit[], recursoId: string) {
        return this.db.auditLog.findMany({
            where: { accion: { in: acciones }, recursoId },
            select: { accion: true, creadoEn: true, valorNuevo: true },
            orderBy: { creadoEn: "asc" },
        });
    }

    groupByUsuario(acciones: AccionAudit[], rango: { gte: Date; lte: Date }) {
        return this.db.auditLog.groupBy({
            by: ["usuarioId"],
            where: { accion: { in: acciones }, creadoEn: rango },
            _count: { usuarioId: true },
        });
    }

    groupByAccion(acciones: AccionAudit[], rango: { gte: Date; lte: Date }) {
        return this.db.auditLog.groupBy({
            by: ["accion"],
            where: { accion: { in: acciones }, creadoEn: rango },
            _count: { accion: true },
        });
    }

    /** Acciones de un conjunto de operadores en el rango (métricas por operador). */
    findAccionesPorOperadores(acciones: AccionAudit[], operadoresIds: string[], rango: { gte: Date; lte: Date }) {
        return this.db.auditLog.findMany({
            where: { accion: { in: acciones }, creadoEn: rango, usuarioId: { in: operadoresIds } },
            select: { usuarioId: true, accion: true, recursoId: true, creadoEn: true },
        });
    }

    /**
     * SPEC-188 (FR-005): eventos de asignación/reasignación/desasignación de un
     * reporte, con el email del usuario ligado al AuditLog (actor o afectado
     * según la acción).
     */
    findAsignacionesReporte(
        recursoId: string
    ): Promise<Prisma.AuditLogGetPayload<{ include: { usuario: { select: { id: true; email: true; nombre: true } } } }>[]> {
        return this.db.auditLog.findMany({
            where: {
                tipoRecurso: "Reporte",
                recursoId,
                accion: { in: ["OPERADOR_ASIGNADO", "OPERADOR_REASIGNADO", "OPERADOR_DESASIGNADO"] },
            },
            orderBy: { creadoEn: "asc" },
            include: { usuario: { select: { id: true, email: true, nombre: true } } },
        });
    }

    /**
     * SPEC-134 (E-1): listado paginado con el actor (nombre/email) para la auditoría
     * del colegio — el `where` lo construye el llamador SIEMPRE con su tenant
     * (`colegioId`). Devuelve [items, total] en una pasada.
     */
    findPaginadosConUsuario(
        where: Prisma.AuditLogWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<[Prisma.AuditLogGetPayload<{ include: { usuario: { select: { nombre: true; email: true } } } }>[], number]> {
        return Promise.all([
            this.db.auditLog.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: { usuario: { select: { nombre: true, email: true } } },
            }),
            this.db.auditLog.count({ where }),
        ]);
    }
}
