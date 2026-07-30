/**
 * SPEC-053 (FR-001): repositorio de ClasificacionIA.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
}
