/**
 * SPEC-053 (US3, módulo Operadores/Comité): repositorio de SolicitudComite.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class SolicitudComiteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Casos del comité; si se pasan estados, filtra por ellos (abiertos). */
    countPorComite(comiteId: string, estados?: Array<"PENDIENTE" | "ASIGNADA">) {
        return this.db.solicitudComite.count({
            where: estados ? { comiteId, estado: { in: estados } } : { comiteId },
        });
    }
}
