/**
 * SPEC-584 (Fase 2) · Repositorio de la auditoría de lectura del texto.
 */
import { prisma } from "../../prisma";
import type { DbClient } from "../unit-of-work";
import type { Prisma } from "@prisma/client";

export class LecturaReporteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Historial de accesos al texto de un reporte (más reciente primero).
     * Solo metadatos: quién, cuándo, qué campo — nunca contenido.
     */
    historialPorReporte(reporteId: string, limite = 50) {
        return this.db.lecturaReporte.findMany({
            where: { reporteId },
            orderBy: { creadoEn: "desc" },
            take: limite,
            select: {
                id: true,
                creadoEn: true,
                campo: true,
                tipoActor: true,
                rol: true,
                usuario: { select: { nombre: true, email: true, rol: true } },
            },
        });
    }
}
