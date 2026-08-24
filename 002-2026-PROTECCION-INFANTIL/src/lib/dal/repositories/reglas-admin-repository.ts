/**
 * SPEC-224 (002-PI-125): repositorio DAL del panel de reglas configurables.
 * Aísla TODO el acceso a Prisma del dominio (frontera Q-3): el servicio
 * (`src/lib/dal/services/reglas-admin.ts`) y las rutas lo consumen; fuera de
 * aquí nadie importa `@/lib/prisma` para este dominio.
 *
 * Mutaciones con auditoría en UNA transacción (patrón de
 * `ReglasRecomendacionRepository.resolverRecomendacionConAuditoria`, SPEC-221):
 * - crear → AuditLog REGLA_CREADA.
 * - editar → snapshot del estado anterior en ReglaRecomendacionHistorial +
 *   version+1 + AuditLog (REGLA_ACTUALIZADA / REGLA_ACTIVADA / REGLA_DESACTIVADA).
 * - cambiar modo → AuditLog REGLA_PROMOVIDA_EJECUTA / REGLA_REVERTIDA_RECOMIENDA.
 * Nunca se auditan textos de reportes ni resultados de queries.
 */
import { Prisma } from "@prisma/client";
import type { AccionAudit, ModoRegla, ReglaRecomendacion, ReglaRecomendacionHistorial } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { construirSnapshot } from "@/lib/analisis/reglas/versionado";
import type { DbClient } from "../unit-of-work";

/** Contexto de auditoría de la request (IP se hashea en logAudit). */
export interface ContextoAudit {
    usuarioId: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

/** Datos de creación de una regla (nace en RECOMIENDA, activa, version 1). */
export interface CreacionRegla {
    clave: string;
    nombre: string;
    descripcion: string;
    categoria: string;
    sqlQuery: string;
    plantillaRecomendacion: string;
    prioridad: number;
    frecuenciaMin: number;
    umbralMinimo: number | null;
    accionEjecutable: string | null;
    accionParametros: Prisma.InputJsonValue | null;
    creadaPorAdminId: string;
}

/** Campos funcionales editables por PATCH (sin clave ni modo). */
export interface CambiosRegla {
    nombre?: string | undefined;
    descripcion?: string | undefined;
    categoria?: string | undefined;
    sqlQuery?: string | undefined;
    plantillaRecomendacion?: string | undefined;
    prioridad?: number | undefined;
    frecuenciaMin?: number | undefined;
    umbralMinimo?: number | null | undefined;
    accionEjecutable?: string | null | undefined;
    accionParametros?: Prisma.InputJsonValue | null | undefined;
    activa?: boolean | undefined;
}

export type HistorialConAdmin = ReglaRecomendacionHistorial & {
    cambiadoPor: { id: string; nombre: string | null };
};

export class ReglasAdminRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Catálogo paginado, ordenado por prioridad descendente (FR-001/FR-003). */
    async listarPaginado(
        where: Prisma.ReglaRecomendacionWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<{ items: ReglaRecomendacion[]; total: number }> {
        const [items, total] = await Promise.all([
            this.db.reglaRecomendacion.findMany({
                where,
                skip: paginacion.skip,
                take: paginacion.take,
                orderBy: { prioridad: "desc" },
            }),
            this.db.reglaRecomendacion.count({ where }),
        ]);
        return { items, total };
    }

    /** Recomendaciones generadas en los últimos 7 días, agrupadas por regla. */
    async conteoUltimos7dPorRegla(reglaIds: string[], desde: Date): Promise<Map<string, number>> {
        if (reglaIds.length === 0) return new Map();
        const grupos = await this.db.recomendacion.groupBy({
            by: ["reglaId"],
            where: { reglaId: { in: reglaIds }, generadaEn: { gte: desde } },
            _count: { _all: true },
        });
        return new Map(grupos.map((g) => [g.reglaId, g._count._all]));
    }

    obtenerPorId(id: string): Promise<ReglaRecomendacion | null> {
        return this.db.reglaRecomendacion.findUnique({ where: { id } });
    }

    obtenerPorClave(clave: string): Promise<ReglaRecomendacion | null> {
        return this.db.reglaRecomendacion.findUnique({ where: { clave } });
    }

    /** Creación en TX: regla (version 1, sin historial) + AuditLog REGLA_CREADA. */
    crearConAuditoria(data: CreacionRegla, audit: ContextoAudit): Promise<ReglaRecomendacion> {
        return prisma.$transaction(async (tx) => {
            const regla = await tx.reglaRecomendacion.create({
                data: {
                    clave: data.clave,
                    nombre: data.nombre,
                    descripcion: data.descripcion,
                    categoria: data.categoria,
                    sqlQuery: data.sqlQuery,
                    plantillaRecomendacion: data.plantillaRecomendacion,
                    modo: "RECOMIENDA",
                    prioridad: data.prioridad,
                    frecuenciaMin: data.frecuenciaMin,
                    umbralMinimo: data.umbralMinimo,
                    accionEjecutable: data.accionEjecutable,
                    accionParametros: data.accionParametros === null ? Prisma.JsonNull : data.accionParametros,
                    activa: true,
                    creadaPorAdminId: data.creadaPorAdminId,
                },
            });
            await logAudit({
                accion: "REGLA_CREADA",
                tipoRecurso: "ReglaRecomendacion",
                recursoId: regla.id,
                usuarioId: audit.usuarioId,
                ipAddress: audit.ipAddress,
                userAgent: audit.userAgent,
                metadatos: { clave: regla.clave, nombre: regla.nombre, categoria: regla.categoria },
                tx,
            });
            return regla;
        });
    }

    /**
     * Edición con versionado en UNA transacción (FR-010): inserta el snapshot
     * del estado anterior (con su `version`) y actualiza con `version + 1`.
     * `reglaAnterior` la leyó el servicio (404 previo); el `@@unique` de
     * (reglaId, version) hace imposible duplicar una versión.
     */
    actualizarConHistorial(params: {
        reglaAnterior: ReglaRecomendacion;
        cambios: CambiosRegla;
        motivo: string;
        accion: Extract<AccionAudit, "REGLA_ACTUALIZADA" | "REGLA_ACTIVADA" | "REGLA_DESACTIVADA">;
        audit: ContextoAudit;
    }): Promise<ReglaRecomendacion> {
        const { reglaAnterior, cambios, motivo, accion, audit } = params;
        return prisma.$transaction(async (tx) => {
            await tx.reglaRecomendacionHistorial.create({
                data: {
                    reglaId: reglaAnterior.id,
                    version: reglaAnterior.version,
                    snapshot: construirSnapshot(reglaAnterior) as Prisma.InputJsonValue,
                    motivo,
                    cambiadoPorAdminId: audit.usuarioId,
                },
            });
            const data: Prisma.ReglaRecomendacionUpdateInput = { version: reglaAnterior.version + 1 };
            if (cambios.nombre !== undefined) data.nombre = cambios.nombre;
            if (cambios.descripcion !== undefined) data.descripcion = cambios.descripcion;
            if (cambios.categoria !== undefined) data.categoria = cambios.categoria;
            if (cambios.sqlQuery !== undefined) data.sqlQuery = cambios.sqlQuery;
            if (cambios.plantillaRecomendacion !== undefined) data.plantillaRecomendacion = cambios.plantillaRecomendacion;
            if (cambios.prioridad !== undefined) data.prioridad = cambios.prioridad;
            if (cambios.frecuenciaMin !== undefined) data.frecuenciaMin = cambios.frecuenciaMin;
            if (cambios.umbralMinimo !== undefined) data.umbralMinimo = cambios.umbralMinimo;
            if (cambios.accionEjecutable !== undefined) data.accionEjecutable = cambios.accionEjecutable;
            if (cambios.activa !== undefined) data.activa = cambios.activa;
            if (cambios.accionParametros !== undefined) {
                data.accionParametros = cambios.accionParametros === null ? Prisma.JsonNull : cambios.accionParametros;
            }
            const actualizada = await tx.reglaRecomendacion.update({
                where: { id: reglaAnterior.id },
                data,
            });
            await logAudit({
                accion,
                tipoRecurso: "ReglaRecomendacion",
                recursoId: reglaAnterior.id,
                usuarioId: audit.usuarioId,
                ipAddress: audit.ipAddress,
                userAgent: audit.userAgent,
                metadatos: {
                    clave: reglaAnterior.clave,
                    versionAnterior: reglaAnterior.version,
                    versionNueva: reglaAnterior.version + 1,
                    motivo,
                },
                tx,
            });
            return actualizada;
        });
    }

    /**
     * Cambio de modo en TX (FR-009): update + AuditLog con valorAnterior /
     * valorNuevo y motivo en metadatos. NO genera versión (el modo no es un
     * campo funcional; su auditoría es la dedicada).
     */
    cambiarModoConAuditoria(params: {
        regla: ReglaRecomendacion;
        modo: ModoRegla;
        motivo: string;
        audit: ContextoAudit;
    }): Promise<ReglaRecomendacion> {
        const { regla, modo, motivo, audit } = params;
        const accion: AccionAudit = modo === "EJECUTA" ? "REGLA_PROMOVIDA_EJECUTA" : "REGLA_REVERTIDA_RECOMIENDA";
        return prisma.$transaction(async (tx) => {
            const actualizada = await tx.reglaRecomendacion.update({
                where: { id: regla.id },
                data: { modo },
            });
            await logAudit({
                accion,
                tipoRecurso: "ReglaRecomendacion",
                recursoId: regla.id,
                usuarioId: audit.usuarioId,
                valorAnterior: regla.modo,
                valorNuevo: modo,
                ipAddress: audit.ipAddress,
                userAgent: audit.userAgent,
                metadatos: { clave: regla.clave, motivo },
                tx,
            });
            return actualizada;
        });
    }

    /** Historial de versiones, más reciente primero (FR-011). */
    async listarHistorial(
        reglaId: string,
        paginacion: { skip: number; take: number }
    ): Promise<{ items: HistorialConAdmin[]; total: number }> {
        const [items, total] = await Promise.all([
            this.db.reglaRecomendacionHistorial.findMany({
                where: { reglaId },
                skip: paginacion.skip,
                take: paginacion.take,
                orderBy: { version: "desc" },
                include: { cambiadoPor: { select: { id: true, nombre: true } } },
            }),
            this.db.reglaRecomendacionHistorial.count({ where: { reglaId } }),
        ]);
        return { items, total };
    }

    /** Una versión concreta del historial (para el diff del borde de página). */
    obtenerHistorialPorVersion(reglaId: string, version: number): Promise<HistorialConAdmin | null> {
        return this.db.reglaRecomendacionHistorial.findUnique({
            where: { reglaId_version: { reglaId, version } },
            include: { cambiadoPor: { select: { id: true, nombre: true } } },
        });
    }

    /** Auditoría del test SQL (REGLA_SQL_TEST): solo metadatos, nunca filas. */
    async auditarTestSql(params: {
        huellaQuery: string;
        duracionMs: number;
        filasMuestra: number;
        reglaId?: string | undefined;
        audit: ContextoAudit;
    }): Promise<void> {
        await logAudit({
            accion: "REGLA_SQL_TEST",
            tipoRecurso: "ReglaRecomendacion",
            recursoId: params.reglaId,
            usuarioId: params.audit.usuarioId,
            ipAddress: params.audit.ipAddress,
            userAgent: params.audit.userAgent,
            metadatos: {
                huellaQuery: params.huellaQuery,
                duracionMs: params.duracionMs,
                filasMuestra: params.filasMuestra,
            },
        });
    }
}
