/**
 * SPEC-053: repositorio de lectura de Plataforma (catálogo).
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class PlataformaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByClave(clave: string) {
        return this.db.plataforma.findUnique({ where: { clave } });
    }

    findById(id: string) {
        return this.db.plataforma.findUnique({ where: { id } });
    }

    /** Nombres por ids (leyenda de agregaciones). */
    findNombresPorIds(ids: string[]) {
        return this.db.plataforma.findMany({
            where: { id: { in: ids } },
            select: { id: true, nombre: true },
        });
    }

    /** SPEC-134 (E-1): plataformas activas del catálogo (validación de carga masiva). */
    findActivas() {
        return this.db.plataforma.findMany({
            where: { esActiva: true },
            select: { id: true, nombre: true },
        });
    }
}
