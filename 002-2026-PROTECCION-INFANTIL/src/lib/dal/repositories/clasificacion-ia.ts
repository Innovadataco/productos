/**
 * SPEC-053 (FR-001): repositorio de ClasificacionIA.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

export class ClasificacionIARepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByReporteId(reporteId: string) {
        return this.db.clasificacionIA.findUnique({ where: { reporteId } });
    }

    crear(data: Prisma.ClasificacionIAUncheckedCreateInput) {
        return this.db.clasificacionIA.create({ data });
    }

    actualizar(id: string, data: Prisma.ClasificacionIAUpdateInput) {
        return this.db.clasificacionIA.update({ where: { id }, data });
    }

    /** Resumen para simulaciones (export/resultados): categoría, confianza, latencia y modelo. */
    findResumenesPorReporteIds(reporteIds: string[]) {
        return this.db.clasificacionIA.findMany({
            where: { reporteId: { in: reporteIds } },
            select: { reporteId: true, categoria: true, confianza: true, latenciaMs: true, modeloUsado: true },
        });
    }

    /** Básico para la comparación de simulaciones: categoría y confianza. */
    findBasicosPorReporteIds(reporteIds: string[]) {
        return this.db.clasificacionIA.findMany({
            where: { reporteId: { in: reporteIds } },
            select: { reporteId: true, categoria: true, confianza: true },
        });
    }

    /** Actualiza por reporteId (resolución del comité: categoría corregida, confianza 1.0). */
    actualizarPorReporteId(reporteId: string, data: Prisma.ClasificacionIAUpdateInput) {
        return this.db.clasificacionIA.update({ where: { reporteId }, data });
    }

    /** E-8: categoría/confianza/latencia/cascada por reportes (métricas de simulación). */
    findParaMetricasPorReporteIds(reporteIds: string[]) {
        return this.db.clasificacionIA.findMany({
            where: { reporteId: { in: reporteIds } },
            select: { reporteId: true, categoria: true, confianza: true, latenciaMs: true, usoCascada: true },
        });
    }

    /**
     * SPEC-186 (002-PI-081): ¿existe alguna clasificación exitosa desde `desde`?
     * La existencia de la fila implica que Ollama respondió; no filtramos por
     * categoría ni confianza.
     */
    async existeClasificacionExitosaDesde(desde: Date): Promise<boolean> {
        const fila = await this.db.clasificacionIA.findFirst({
            where: { creadoEn: { gte: desde } },
            select: { id: true },
            orderBy: { creadoEn: "desc" },
        });
        return fila !== null;
    }

    /** SPEC-186: última clasificación exitosa dentro de una ventana (para detalle del piggyback). */
    async ultimaClasificacionExitosaDesde(desde: Date): Promise<{ creadoEn: Date } | null> {
        return this.db.clasificacionIA.findFirst({
            where: { creadoEn: { gte: desde } },
            select: { creadoEn: true },
            orderBy: { creadoEn: "desc" },
        });
    }
}
