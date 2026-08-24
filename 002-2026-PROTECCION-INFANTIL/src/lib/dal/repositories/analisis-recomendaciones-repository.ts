/**
 * SPEC-227 (002-PI-128): repositorio DAL del historial de recomendaciones.
 * SOLO LECTURA sobre `Recomendacion`/`ReglaRecomendacion` (SPEC-221): esta spec
 * nunca escribe en el dominio de recomendaciones (FR-014). La única escritura
 * es el `AuditLog` de cada exportación (FR-008).
 *
 * El promedio de tiempo de resolución usa `$queryRaw` con `Prisma.sql`
 * parametrizado (plan §2.3): columnas fijas citadas, ningún string de usuario
 * interpolado; el enum se castea explícitamente.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";
import type { FiltrosHistorial } from "@/lib/analisis/filtros-historial";

const SELECT_REGLA = { id: true, clave: true, nombre: true } as const;

export type RecomendacionConRegla = Prisma.RecomendacionGetPayload<{
    include: { regla: { select: typeof SELECT_REGLA } };
}>;

export type RecomendacionExportDb = Prisma.RecomendacionGetPayload<{
    select: {
        id: true;
        categoria: true;
        prioridad: true;
        estado: true;
        generadaEn: true;
        resueltaEn: true;
        ejecutadaAutomatica: true;
        sujetoTipo: true;
        sujetoId: true;
        regla: { select: { clave: true; nombre: true } };
    };
}>;

export interface ConteoEstado {
    estado: string;
    total: number;
}

export interface ConteoReglaEstado {
    reglaId: string;
    estado: string;
    total: number;
}

/** `where` ORM tipado a partir de los filtros resueltos (nunca `any`). */
export function construirWhereHistorial(filtros: FiltrosHistorial): Prisma.RecomendacionWhereInput {
    const where: Prisma.RecomendacionWhereInput = {};
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.reglaId) where.reglaId = filtros.reglaId;
    if (filtros.categoria) where.categoria = filtros.categoria;
    if (filtros.sujetoTipo) where.sujetoTipo = filtros.sujetoTipo;
    if (filtros.sujetoId) where.sujetoId = filtros.sujetoId;
    if (filtros.ejecutadaAutomatica !== undefined) where.ejecutadaAutomatica = filtros.ejecutadaAutomatica;
    if (filtros.generadaDesdeUtc || filtros.generadaHastaUtc) {
        where.generadaEn = {
            ...(filtros.generadaDesdeUtc ? { gte: filtros.generadaDesdeUtc } : {}),
            ...(filtros.generadaHastaUtc ? { lte: filtros.generadaHastaUtc } : {}),
        };
    }
    return where;
}

/**
 * Equivalente SQL de `construirWhereHistorial` para las agregaciones raw.
 * Solo fragmentos fijos con valores parametrizados (`Prisma.sql`).
 */
function construirWhereSql(filtros: FiltrosHistorial): Prisma.Sql {
    const fragmentos: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (filtros.estado) fragmentos.push(Prisma.sql`"estado" = ${filtros.estado}::"EstadoRecomendacion"`);
    if (filtros.reglaId) fragmentos.push(Prisma.sql`"reglaId" = ${filtros.reglaId}`);
    if (filtros.categoria) fragmentos.push(Prisma.sql`"categoria" = ${filtros.categoria}`);
    if (filtros.sujetoTipo) fragmentos.push(Prisma.sql`"sujetoTipo" = ${filtros.sujetoTipo}`);
    if (filtros.sujetoId) fragmentos.push(Prisma.sql`"sujetoId" = ${filtros.sujetoId}`);
    if (filtros.ejecutadaAutomatica !== undefined) {
        fragmentos.push(Prisma.sql`"ejecutadaAutomatica" = ${filtros.ejecutadaAutomatica}`);
    }
    if (filtros.generadaDesdeUtc) fragmentos.push(Prisma.sql`"generadaEn" >= ${filtros.generadaDesdeUtc}`);
    if (filtros.generadaHastaUtc) fragmentos.push(Prisma.sql`"generadaEn" <= ${filtros.generadaHastaUtc}`);
    return Prisma.join(fragmentos, " AND ");
}

export class AnalisisRecomendacionesRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Lista paginada con su regla (`id`/`clave`/`nombre`), orden `generadaEn` desc. */
    findPaginadasConTotal(
        where: Prisma.RecomendacionWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<[RecomendacionConRegla[], number]> {
        return Promise.all([
            this.db.recomendacion.findMany({
                where,
                include: { regla: { select: SELECT_REGLA } },
                orderBy: [{ generadaEn: "desc" }, { id: "desc" }],
                skip: paginacion.skip,
                take: paginacion.take,
            }),
            this.db.recomendacion.count({ where }),
        ]);
    }

    /** Totales por estado del conjunto filtrado. */
    async conteoPorEstado(where: Prisma.RecomendacionWhereInput): Promise<ConteoEstado[]> {
        const grupos = await this.db.recomendacion.groupBy({
            by: ["estado"],
            where,
            _count: { _all: true },
        });
        return grupos.map((g) => ({ estado: g.estado, total: g._count._all }));
    }

    /** Totales por (regla, estado) del conjunto filtrado — base del bloque "Por regla". */
    async conteoPorReglaYEstado(where: Prisma.RecomendacionWhereInput): Promise<ConteoReglaEstado[]> {
        const grupos = await this.db.recomendacion.groupBy({
            by: ["reglaId", "estado"],
            where,
            _count: { _all: true },
        });
        return grupos.map((g) => ({ reglaId: g.reglaId, estado: g.estado, total: g._count._all }));
    }

    /**
     * Promedio global de horas de resolución (`resueltaEn - generadaEn`) del
     * conjunto filtrado, solo filas con `resueltaEn` no nula. `null` si no hay.
     */
    async promedioResolucionHorasGlobal(filtros: FiltrosHistorial): Promise<number | null> {
        const filas = await this.db.$queryRaw<{ promedio: number | null }[]>`
            SELECT AVG(EXTRACT(EPOCH FROM ("resueltaEn" - "generadaEn")) / 3600.0)::float8 AS promedio
            FROM "recomendaciones"
            WHERE "resueltaEn" IS NOT NULL AND ${construirWhereSql(filtros)}
        `;
        return filas[0]?.promedio ?? null;
    }

    /** Promedio de horas de resolución desagregado por regla (mismo criterio). */
    async promedioResolucionHorasPorRegla(filtros: FiltrosHistorial): Promise<Map<string, number | null>> {
        const filas = await this.db.$queryRaw<{ reglaId: string; promedio: number | null }[]>`
            SELECT "reglaId", AVG(EXTRACT(EPOCH FROM ("resueltaEn" - "generadaEn")) / 3600.0)::float8 AS promedio
            FROM "recomendaciones"
            WHERE "resueltaEn" IS NOT NULL AND ${construirWhereSql(filtros)}
            GROUP BY "reglaId"
        `;
        return new Map(filas.map((f) => [f.reglaId, f.promedio]));
    }

    contar(where: Prisma.RecomendacionWhereInput): Promise<number> {
        return this.db.recomendacion.count({ where });
    }

    /** Subconjunto filtrado para el CSV: metadatos fijos, sin título/descripción/datosContexto. */
    findParaExport(where: Prisma.RecomendacionWhereInput): Promise<RecomendacionExportDb[]> {
        return this.db.recomendacion.findMany({
            where,
            select: {
                id: true,
                categoria: true,
                prioridad: true,
                estado: true,
                generadaEn: true,
                resueltaEn: true,
                ejecutadaAutomatica: true,
                sujetoTipo: true,
                sujetoId: true,
                regla: { select: { clave: true, nombre: true } },
            },
            orderBy: [{ generadaEn: "desc" }, { id: "desc" }],
        });
    }

    /** Reglas para el select de filtro de la vista (activas e inactivas: el historial conserva ambas). */
    listarReglasParaFiltro(): Promise<{ id: string; clave: string; nombre: string; categoria: string }[]> {
        return this.db.reglaRecomendacion.findMany({
            select: { ...SELECT_REGLA, categoria: true },
            orderBy: { nombre: "asc" },
        });
    }

    /** Reglas por id (nombres del bloque "Por regla" en métricas). */
    findReglasPorIds(ids: string[]): Promise<{ id: string; clave: string; nombre: string }[]> {
        return this.db.reglaRecomendacion.findMany({
            where: { id: { in: ids } },
            select: SELECT_REGLA,
        });
    }

    /** FR-008: una fila de auditoría por exportación (metadatos, nunca contenido). */
    async registrarAuditoriaExport(data: {
        usuarioId: string;
        metadatos: Prisma.InputJsonValue;
        ipAddress: string;
        userAgent: string;
    }): Promise<void> {
        await this.db.auditLog.create({
            data: {
                accion: "RECOMENDACIONES_EXPORT_CSV",
                tipoRecurso: "Recomendacion",
                usuarioId: data.usuarioId,
                metadatos: data.metadatos,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
            },
        });
    }
}
