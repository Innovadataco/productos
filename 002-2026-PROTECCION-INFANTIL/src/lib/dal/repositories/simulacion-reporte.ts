/**
 * SPEC-053 (US3, módulo IA): repositorio de SimulacionReporte (reportes
 * generados por cada corrida de simulación). Acepta un cliente transaccional
 * opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class SimulacionReporteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Todos los reportes de una corrida, ordenados por índice del caso. */
    findPorRunOrdenados(simulacionRunId: string) {
        return this.db.simulacionReporte.findMany({
            where: { simulacionRunId },
            orderBy: { indice: "asc" },
        });
    }

    /** Reportes paginados de una corrida: items + total en una pasada. */
    findPaginadosConTotal(simulacionRunId: string, paginacion: { skip: number; take: number }) {
        return Promise.all([
            this.db.simulacionReporte.findMany({
                where: { simulacionRunId },
                orderBy: { indice: "asc" },
                skip: paginacion.skip,
                take: paginacion.take,
            }),
            this.db.simulacionReporte.count({ where: { simulacionRunId } }),
        ]);
    }
}
