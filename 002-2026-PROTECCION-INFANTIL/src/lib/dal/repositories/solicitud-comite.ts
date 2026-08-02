/**
 * SPEC-053 (US3, módulo Operadores/Comité): repositorio de SolicitudComite.
 * Bandeja del comité (pendientes, propias, listado admin) y ciclo de vida de la
 * solicitud (asignar, reasignar, resolver). Acepta un cliente transaccional
 * opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const SELECT_BANDEJA = {
    id: true,
    numero: true,
    reporteId: true,
    estado: true,
    motivo: true,
    creadoEn: true,
} satisfies Prisma.SolicitudComiteSelect;

const SELECT_BANDEJA_CON_COMITE = {
    ...SELECT_BANDEJA,
    comiteId: true,
} satisfies Prisma.SolicitudComiteSelect;

export type SolicitudComiteBandejaRow = Prisma.SolicitudComiteGetPayload<{ select: typeof SELECT_BANDEJA }>;
export type SolicitudComiteBandejaConComiteRow = Prisma.SolicitudComiteGetPayload<{
    select: typeof SELECT_BANDEJA_CON_COMITE;
}>;

export class SolicitudComiteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Casos del comité; si se pasan estados, filtra por ellos (abiertos). */
    countPorComite(comiteId: string, estados?: Array<"PENDIENTE" | "ASIGNADA">) {
        return this.db.solicitudComite.count({
            where: estados ? { comiteId, estado: { in: estados } } : { comiteId },
        });
    }

    /** Bandeja de pendientes sin asignar (admin y comité): items + total en una pasada. */
    findPendientesSinAsignar(paginacion: { skip: number; take: number }): Promise<[SolicitudComiteBandejaRow[], number]> {
        const where = { estado: "PENDIENTE", comiteId: null };
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

    /** Casos abiertos asignados a un miembro del comité ("mías"): items + total. */
    findAsignadasPorComite(
        comiteId: string,
        paginacion: { skip: number; take: number }
    ): Promise<[SolicitudComiteBandejaConComiteRow[], number]> {
        const where = { comiteId, estado: { in: ["PENDIENTE", "ASIGNADA"] } };
        return Promise.all([
            this.db.solicitudComite.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                select: SELECT_BANDEJA_CON_COMITE,
            }),
            this.db.solicitudComite.count({ where }),
        ]);
    }

    /** Listado general de la bandeja (filtro por rol lo arma el servicio): items + total. */
    findBandeja(
        where: Prisma.SolicitudComiteWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<[SolicitudComiteBandejaConComiteRow[], number]> {
        return Promise.all([
            this.db.solicitudComite.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                select: SELECT_BANDEJA_CON_COMITE,
            }),
            this.db.solicitudComite.count({ where }),
        ]);
    }

    /**
     * SPEC-139 (F5, ZEUS D-3): bandeja COMPLETA con la clave del identificador
     * (prioridad inter-ciudad: el orden se aplica en el servicio antes de paginar;
     * el select sigue siendo ligero — sin textos ni denunciantes).
     */
    findBandejaCompletaConReporte(where: Prisma.SolicitudComiteWhereInput) {
        return this.db.solicitudComite.findMany({
            where,
            orderBy: { creadoEn: "desc" },
            select: {
                ...SELECT_BANDEJA_CON_COMITE,
                reporte: { select: { identificador: true, plataformaId: true } },
            },
        });
    }

    /** Solicitud con su reporte (asignar/reasignar). */
    findByIdConReporte(id: string) {
        return this.db.solicitudComite.findUnique({
            where: { id },
            include: { reporte: true },
        });
    }

    /** Solicitud con reporte y clasificación (resolver). */
    findByIdConReporteYClasificacion(id: string) {
        return this.db.solicitudComite.findUnique({
            where: { id },
            include: { reporte: { include: { clasificacion: true } } },
        });
    }

    /** E-8: solicitud de un reporte (guarda "ya escalado"). */
    findPorReporteId(reporteId: string) {
        return this.db.solicitudComite.findUnique({
            where: { reporteId },
        });
    }

    /** E-8: solicitud por número público (unicidad al generar el número). */
    findPorNumero(numero: string) {
        return this.db.solicitudComite.findUnique({
            where: { numero },
        });
    }

    /** E-8: crea la solicitud (dentro de la tx de escalación). */
    crear(data: Prisma.SolicitudComiteUncheckedCreateInput) {
        return this.db.solicitudComite.create({ data });
    }

    /** E-8: pendientes del comité (propias o sin asignar) para la alerta por email. */
    contarPendientesParaComite(comiteId: string) {
        return this.db.solicitudComite.count({
            where: {
                estado: { in: ["PENDIENTE", "ASIGNADA"] },
                OR: [{ comiteId }, { comiteId: null }],
            },
        });
    }

    actualizar(id: string, data: Prisma.SolicitudComiteUncheckedUpdateInput) {
        return this.db.solicitudComite.update({ where: { id }, data });
    }
}
