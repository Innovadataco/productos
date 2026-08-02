/**
 * E-8 (002-PI-056): repositorio de Pais (catálogo geográfico).
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class PaisRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** GET /api/paises: activos, alfabéticos. */
    listarActivos() {
        return this.db.pais.findMany({
            where: { esActivo: true },
            orderBy: { nombre: "asc" },
            select: { id: true, codigo: true, nombre: true },
        });
    }
}
