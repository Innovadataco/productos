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

    /** E-8: alta del vínculo caso↔reporte (dentro de la tx de creación del reporte). */
    crear(data: Prisma.SimulacionReporteUncheckedCreateInput) {
        return this.db.simulacionReporte.create({ data });
    }

    /** E-8: índices ya creados de la corrida (reanudabilidad del batch creator). */
    findIndicesPorRun(simulacionRunId: string) {
        return this.db.simulacionReporte.findMany({
            where: { simulacionRunId },
            select: { indice: true },
        });
    }

    /** E-8: ids de reporte de la corrida (progreso de la simulación). */
    findReporteIdsPorRun(simulacionRunId: string) {
        return this.db.simulacionReporte.findMany({
            where: { simulacionRunId },
            select: { reporteId: true },
        });
    }

    /** E-8: vínculo por reporte (hook de progreso desde el procesamiento). */
    findPorReporteId(reporteId: string) {
        return this.db.simulacionReporte.findUnique({ where: { reporteId } });
    }

    /** E-8: casos con expectativas para las métricas de la corrida. */
    findParaMetricas(simulacionRunId: string) {
        return this.db.simulacionReporte.findMany({
            where: { simulacionRunId },
            select: { reporteId: true, indice: true, categoriaEsperada: true, secundariaEsperada: true },
        });
    }
}
