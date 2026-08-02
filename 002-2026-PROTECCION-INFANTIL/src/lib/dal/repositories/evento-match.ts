/**
 * SPEC-139 (F5): repositorio de EventoMatch — el KPI del match (segundo reporte
 * independiente del mismo identificador). Entidad global (sin tenant): el match
 * cruza tenants como la consulta pública. Acepta un cliente transaccional
 * opcional (D2). Las lecturas NUNCA exponen denunciantes ni textos (FR-009).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const SELECT_DETALLE_ADMIN = {
    id: true,
    conteoAcumulado: true,
    ciudades: true,
    conductasCoincidentes: true,
    interCiudad: true,
    creadoEn: true,
    identificador: { select: { identificador: true, plataformaId: true } },
} satisfies Prisma.EventoMatchSelect;

export type EventoMatchDetalleRow = Prisma.EventoMatchGetPayload<{ select: typeof SELECT_DETALLE_ADMIN }>;

export class EventoMatchRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Alta del evento (idempotencia por reporteNuevoId único, FR-004). */
    crear(data: Prisma.EventoMatchUncheckedCreateInput) {
        return this.db.eventoMatch.create({ data });
    }

    /** Guarda de idempotencia: ¿este reporte ya disparó su evento? */
    findPorReporteNuevoId(reporteNuevoId: string) {
        return this.db.eventoMatch.findUnique({ where: { reporteNuevoId } });
    }

    /** Conteo público agregado (FR-008): identificadores distintos con match. */
    async contarIdentificadoresConMatch(): Promise<number> {
        const grupos = await this.db.eventoMatch.groupBy({ by: ["identificadorId"] });
        return grupos.length;
    }

    /** Listado admin paginado (FR-008): solo metadatos agregados, orden reciente. */
    findPaginadosConDetalle(paginacion: { skip: number; take: number }): Promise<[EventoMatchDetalleRow[], number]> {
        return Promise.all([
            this.db.eventoMatch.findMany({
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                select: SELECT_DETALLE_ADMIN,
            }),
            this.db.eventoMatch.count(),
        ]);
    }

    /** Tendencia temporal agregada (matches por mes, ascendente). */
    tendenciaPorMes(): Promise<{ mes: string; total: number }[]> {
        return this.db.$queryRaw<{ mes: string; total: number }[]>`
            SELECT TO_CHAR(DATE_TRUNC('month', "creadoEn"), 'YYYY-MM') AS mes,
                   COUNT(*)::int AS total
            FROM "eventos_match"
            GROUP BY 1
            ORDER BY 1 ASC
        `;
    }

    /**
     * Matches inter-ciudad de un conjunto de identificadores+plataforma (badge de
     * la bandeja del comité, FR-006). Devuelve los pares que tienen match marcado.
     */
    async findInterCiudadPorPares(
        pares: { identificador: string; plataformaId: string }[]
    ): Promise<{ identificador: string; plataformaId: string }[]> {
        if (pares.length === 0) return [];
        const filas = await this.db.eventoMatch.findMany({
            where: {
                interCiudad: true,
                OR: pares.map((p) => ({
                    identificador: { identificador: p.identificador, plataformaId: p.plataformaId },
                })),
            },
            select: { identificador: { select: { identificador: true, plataformaId: true } } },
        });
        return filas.map((f) => f.identificador);
    }
}
