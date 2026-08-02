/**
 * E-8 (002-PI-056): repositorio de PasoProcesamiento — traza de pasos del
 * pipeline del reporte (spec 096-US3, capa 2 del expediente).
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class PasoProcesamientoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Pasos del reporte en orden de registro (ensamblador del expediente). */
    findPorReporteOrdenados(reporteId: string) {
        return this.db.pasoProcesamiento.findMany({
            where: { reporteId },
            orderBy: { creadoEn: "asc" },
        });
    }

    /** Registro best-effort de un paso (la política de no propagar es del servicio). */
    crear(data: Prisma.PasoProcesamientoUncheckedCreateInput) {
        return this.db.pasoProcesamiento.create({ data });
    }
}
