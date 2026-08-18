/**
 * SPEC-168 (Fase F): bandeja de casos escalados al Comité de Convivencia,
 * colegio-scoped por construcción.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const SELECT_BANDEJA = {
    id: true,
    numero: true,
    estado: true,
    motivo: true,
    creadoEn: true,
    resueltoEn: true,
} satisfies Prisma.SolicitudComiteSelect;

export type SolicitudComiteConvivenciaRow = Prisma.SolicitudComiteGetPayload<{ select: typeof SELECT_BANDEJA }>;

export class ComiteConvivenciaSolicitudesRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    listarPorColegio(
        colegioId: string,
        paginacion: { skip: number; take: number }
    ): Promise<[SolicitudComiteConvivenciaRow[], number]> {
        const where = { colegioId };
        return Promise.all([
            this.db.solicitudComite.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                select: SELECT_BANDEJA,
            }),
            this.db.solicitudComite.count({ where }),
        ]);
    }

    obtenerPorId(id: string) {
        return this.db.solicitudComite.findUnique({
            where: { id },
            select: {
                ...SELECT_BANDEJA,
                colegioId: true,
                alertaColegioId: true,
                reporteId: true,
                resolucion: true,
            },
        });
    }

    obtenerPorAlertaId(alertaColegioId: string) {
        return this.db.solicitudComite.findUnique({
            where: { alertaColegioId },
            select: { id: true },
        });
    }

    crear(data: Prisma.SolicitudComiteUncheckedCreateInput) {
        return this.db.solicitudComite.create({
            data,
            select: SELECT_BANDEJA,
        });
    }

    resolver(id: string, resolucion: string) {
        return this.db.solicitudComite.update({
            where: { id },
            data: { estado: "RESUELTA", resolucion, resueltoEn: new Date() },
            select: SELECT_BANDEJA,
        });
    }

    /**
     * SPEC-173: resumen para la home del comité. Solo metadatos (número,
     * categoría, estado, fechas, SLA); nunca texto de reporte ni denunciante.
     */
    async resumenPorColegio(colegioId: string, usuarioId: string, slaHasta: Date, takeSla: number) {
        const abiertos: Prisma.SolicitudComiteWhereInput = { colegioId, estado: "PENDIENTE" };
        const [casosAbiertos, misCasosAsignados, proximosSla] = await Promise.all([
            this.db.solicitudComite.count({ where: abiertos }),
            this.db.solicitudComite.count({
                where: { ...abiertos, alerta: { asignadoAId: usuarioId } },
            }),
            this.db.solicitudComite.findMany({
                where: { ...abiertos, alerta: { vencimientoSla: { lte: slaHasta } } },
                orderBy: { alerta: { vencimientoSla: "asc" } },
                take: takeSla,
                select: {
                    id: true,
                    numero: true,
                    estado: true,
                    creadoEn: true,
                    alerta: { select: { prioridad: true, vencimientoSla: true } },
                    reporte: { select: { clasificacion: { select: { categoria: true } } } },
                },
            }),
        ]);
        return { casosAbiertos, misCasosAsignados, proximosSla };
    }

    /** SPEC-173: agregados de la bandeja, colegio-scoped. */
    async estadisticasPorColegio(colegioId: string, takeTopCategorias: number) {
        const [porEstado, resueltas, porCategoria] = await Promise.all([
            this.db.solicitudComite.groupBy({
                by: ["estado"],
                where: { colegioId },
                _count: { _all: true },
            }),
            this.db.solicitudComite.findMany({
                where: { colegioId, resueltoEn: { not: null } },
                select: { creadoEn: true, resueltoEn: true },
            }),
            this.db.clasificacionIA.groupBy({
                by: ["categoria"],
                where: { reporte: { solicitudComite: { colegioId } } },
                _count: { _all: true },
                orderBy: { _count: { categoria: "desc" } },
                take: takeTopCategorias,
            }),
        ]);
        return { porEstado, resueltas, porCategoria };
    }
}
