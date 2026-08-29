/**
 * E-8 (002-PI-056): repositorio de Departamento (catálogo geográfico).
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class DepartamentoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** GET /api/departamentos: activos del país, alfabéticos. */
    listarActivosPorPais(paisId: string) {
        return this.db.departamento.findMany({
            where: { paisId, esActivo: true },
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true, paisId: true },
        });
    }

    /** E-8: departamento por id (validación de ubicación en gestión admin de colegios). */
    findById(id: string) {
        return this.db.departamento.findUnique({ where: { id } });
    }
}
