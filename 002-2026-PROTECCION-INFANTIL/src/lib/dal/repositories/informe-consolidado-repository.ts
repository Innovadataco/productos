/**
 * SPEC-234 (002-PI-134): repositorio del agregado InformeConsolidado.
 * Frontera DAL (Q-3): todo acceso a estas entidades pasa por aquí.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export interface CrearInformeInput {
    expedienteId: string;
    versionSecuencial: number;
    scoreValor: number;
    scoreGravedad: string;
    categoriasDetectadasJson: Prisma.InputJsonValue;
    patronesDetectadosJson?: Prisma.InputJsonValue | undefined;
    senalComunitariaJson?: Prisma.InputJsonValue | undefined;
    resumenTextoGenerado: string;
    pdfUrl?: string | undefined;
    pdfHash?: string | undefined;
    pdfGeneradoEn?: Date | undefined;
    generadoPorId?: string | undefined;
    tipoRevision?: string | undefined;
    guiaAccionCategoriaIdPrincipal?: string | undefined;
    estadoAprobacion?: string | undefined;
    aprobadoPorMiembrosJson?: Prisma.InputJsonValue | undefined;
    correccionesJson?: Prisma.InputJsonValue | undefined;
    nivelConfianza?: number | undefined;
}

export interface PaginacionInput {
    page: number;
    pageSize: number;
}

export class InformeConsolidadoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    crearInforme(data: CrearInformeInput) {
        return this.db.informeConsolidado.create({
            data: {
                ...data,
                scoreGravedad: (data.scoreGravedad as never) ?? "VERDE",
                tipoRevision: (data.tipoRevision as never) ?? "CONSOLIDACION_EXPEDIENTE",
            } as never,
        });
    }

    obtenerPorId(id: string) {
        return this.db.informeConsolidado.findUnique({ where: { id } });
    }

    obtenerPorHash(pdfHash: string) {
        return this.db.informeConsolidado.findUnique({ where: { pdfHash } });
    }

    async listarPorExpediente(
        expedienteId: string,
        paginacion: PaginacionInput = { page: 1, pageSize: 25 }
    ) {
        const page = Math.max(1, paginacion.page);
        const pageSize = Math.min(100, Math.max(1, paginacion.pageSize));
        const skip = (page - 1) * pageSize;

        const [items, total] = await Promise.all([
            this.db.informeConsolidado.findMany({
                where: { expedienteId },
                orderBy: { versionSecuencial: "desc" },
                skip,
                take: pageSize,
            }),
            this.db.informeConsolidado.count({ where: { expedienteId } }),
        ]);

        return {
            items,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    obtenerUltimaVersion(expedienteId: string) {
        return this.db.informeConsolidado.findFirst({
            where: { expedienteId },
            orderBy: { versionSecuencial: "desc" },
        });
    }
}
