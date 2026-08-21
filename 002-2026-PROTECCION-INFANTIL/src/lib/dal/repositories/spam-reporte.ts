/**
 * SPEC-195 (002-PI-089): repositorio de queries específicas del flujo de spam.
 * Separa los métodos de analítica, SLA y banco de ejemplos para no inflar
 * ReporteRepository más allá del techo de líneas.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class SpamReporteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Reportes POSIBLE_SPAM vencidos para alerta de SLA. */
    findSpamVencidos(limite: Date, take: number) {
        return this.db.reporte.findMany({
            where: {
                estado: "POSIBLE_SPAM",
                eliminado: false,
                creadoEn: { lt: limite },
            },
            select: {
                id: true,
                numeroSeguimiento: true,
                identificador: true,
                creadoEn: true,
            },
            orderBy: { creadoEn: "asc" },
            take,
        });
    }

    /** Reportes dados de baja como spam en la ventana (analítica). */
    findReportesSpamEliminados(inicio: Date) {
        return this.db.reporte.findMany({
            where: {
                eliminado: true,
                motivoBaja: "RETIRO_LIMPIEZA",
                eliminadoEn: { gte: inicio },
            },
            select: {
                identificador: true,
                plataformaId: true,
                plataforma: { select: { nombre: true } },
            },
        });
    }

    /** Reportes corregidos desde spam en la ventana (analítica). */
    findReportesCorregidosDeSpam(inicio: Date) {
        return this.db.reporte.findMany({
            where: {
                estado: "CLASIFICADO",
                actualizadoEn: { gte: inicio },
                clasificacion: { correccion: { categoriaOriginal: "SPAM" } },
            },
            select: {
                identificador: true,
                plataformaId: true,
                plataforma: { select: { nombre: true } },
                clasificacion: { select: { correccion: { select: { categoriaCorregida: true } } } },
            },
        });
    }

    /** Fecha de creación de reportes para cálculo de tiempos de resolución. */
    findCreadoEnPorIds(ids: string[]) {
        return this.db.reporte.findMany({
            where: { id: { in: ids } },
            select: { id: true, creadoEn: true },
        });
    }

    /** Candidatos para sugerir al banco de ejemplos spam. */
    findSugerenciasBancoSpam(inicio: Date, take: number) {
        return this.db.reporte.findMany({
            where: {
                eliminado: true,
                motivoBaja: "RETIRO_LIMPIEZA",
                eliminadoEn: { gte: inicio },
            },
            select: {
                id: true,
                texto: true,
                eliminadoEn: true,
            },
            orderBy: { eliminadoEn: "desc" },
            take,
        });
    }
}
