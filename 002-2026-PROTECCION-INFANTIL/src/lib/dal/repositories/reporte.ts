/**
 * SPEC-053 (FR-001): repositorio del agregado Reporte.
 * Encapsula CRUD y búsquedas; acepta un cliente transaccional opcional (D2).
 * Los tipos de retorno son payloads de Prisma: solo los servicios del DAL los
 * consumen y los mapean a DTOs; NUNCA llegan a una ruta (FR-007).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_CON_DETALLE = {
    plataforma: { select: { nombre: true, clave: true } },
    clasificacion: true,
} satisfies Prisma.ReporteInclude;

const SELECT_SEGUIMIENTO = {
    id: true,
    identificador: true,
    plataformaId: true,
    plataforma: { select: { clave: true, nombre: true } },
    otraPlataforma: true,
    estado: true,
    eliminado: true,
    creadoEn: true,
    actualizadoEn: true,
    numeroSeguimiento: true,
    clasificacion: true,
} satisfies Prisma.ReporteSelect;

export type ReporteConDetalle = Prisma.ReporteGetPayload<{ include: typeof INCLUDE_CON_DETALLE }>;
export type ReporteSeguimientoRow = Prisma.ReporteGetPayload<{ select: typeof SELECT_SEGUIMIENTO }>;

export interface PaginacionInput {
    skip: number;
    take: number;
}

export class ReporteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByIdConDetalle(id: string): Promise<ReporteConDetalle | null> {
        return this.db.reporte.findUnique({ where: { id }, include: INCLUDE_CON_DETALLE });
    }

    findByNumeroSeguimiento(numeroSeguimiento: string): Promise<ReporteSeguimientoRow | null> {
        return this.db.reporte.findUnique({
            where: { numeroSeguimiento },
            select: SELECT_SEGUIMIENTO,
        });
    }

    /** Listado paginado del autor ("mis reportes"): items + total en una pasada. */
    findPaginadosConTotal(
        where: Prisma.ReporteWhereInput,
        paginacion: PaginacionInput
    ): Promise<[ReporteConDetalle[], number]> {
        return Promise.all([
            this.db.reporte.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: INCLUDE_CON_DETALLE,
            }),
            this.db.reporte.count({ where }),
        ]);
    }

    /** Deduplicación autenticada: mismo usuario + identificador desde `desde`. */
    findDuplicadoReciente(usuarioId: string, identificador: string, desde: Date) {
        return this.db.reporte.findFirst({
            where: { usuarioId, identificador, creadoEn: { gte: desde } },
            orderBy: { creadoEn: "desc" },
        });
    }

    existeNumeroSeguimiento(numeroSeguimiento: string): Promise<boolean> {
        return this.db.reporte
            .findUnique({ where: { numeroSeguimiento }, select: { id: true } })
            .then((r) => r !== null);
    }

    crear(data: Prisma.ReporteUncheckedCreateInput) {
        return this.db.reporte.create({ data });
    }

    actualizarEstado(id: string, data: Prisma.ReporteUpdateInput) {
        return this.db.reporte.update({ where: { id }, data });
    }
}
