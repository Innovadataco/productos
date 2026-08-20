/**
 * SPEC-184 (002-PI-079): repositorio de SimulacionAbusoRun.
 * Frontera DAL (Q-3): todo acceso a SimulacionAbusoRun pasa por aquí.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class SimulacionAbusoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findById(id: string) {
        return this.db.simulacionAbusoRun.findUnique({ where: { id } });
    }

    findPendientesOEnProgreso() {
        return this.db.simulacionAbusoRun.findMany({
            where: { estado: { in: ["PENDIENTE", "EN_PROGRESO"] } },
            orderBy: { creadoEn: "asc" },
        });
    }

    crear(data: Prisma.SimulacionAbusoRunUncheckedCreateInput) {
        return this.db.simulacionAbusoRun.create({ data });
    }

    actualizar(id: string, data: Prisma.SimulacionAbusoRunUncheckedUpdateInput) {
        return this.db.simulacionAbusoRun.update({ where: { id }, data });
    }
}
