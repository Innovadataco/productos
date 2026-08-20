/**
 * SPEC-189 (002-PI-084): repositorio de consultas de Reporte específicas para
 * métricas y listados de operadores. Extraído de ReporteRepository para respetar
 * el límite de tamaño de archivo (max-lines).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export interface PaginacionInput {
    skip: number;
    take: number;
}

const SELECT_CASO_OPERADOR = {
    id: true,
    numeroSeguimiento: true,
    identificador: true,
    estado: true,
    creadoEn: true,
    plataforma: { select: { clave: true, nombre: true } },
    clasificacion: { select: { categoria: true } },
} satisfies Prisma.ReporteSelect;

export type CasoOperadorRow = Prisma.ReporteGetPayload<{ select: typeof SELECT_CASO_OPERADOR }>;

export class ReporteOperadorRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** SPEC-189: listado paginado de casos de un operador. */
    findCasosOperador(
        where: Prisma.ReporteWhereInput,
        paginacion: PaginacionInput
    ): Promise<[CasoOperadorRow[], number]> {
        return Promise.all([
            this.db.reporte.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                select: SELECT_CASO_OPERADOR,
            }),
            this.db.reporte.count({ where }),
        ]);
    }

    /** SPEC-189: categorías de clasificación de un conjunto de reportes. */
    async categoriasPorIds(ids: string[]): Promise<Array<{ categoria: string; total: number }>> {
        const rows = await this.db.reporte.findMany({
            where: { id: { in: ids } },
            select: { clasificacion: { select: { categoria: true } } },
        });

        const conteoPorCategoria = new Map<string, number>();
        for (const row of rows) {
            const categoria = row.clasificacion?.categoria ?? "Sin categoría";
            conteoPorCategoria.set(categoria, (conteoPorCategoria.get(categoria) ?? 0) + 1);
        }

        return [...conteoPorCategoria.entries()]
            .map(([categoria, total]) => ({ categoria, total }))
            .sort((a, b) => b.total - a.total);
    }
}
