/**
 * SPEC-053 (US3, módulo Estadísticas): repositorio de Ciudad (catálogo geográfico).
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class CiudadRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Ciudades con coordenadas y país (mapa del dashboard público). */
    findManyConCoords(ids: string[]) {
        return this.db.ciudad.findMany({
            where: { id: { in: ids } },
            select: { id: true, nombre: true, pais: { select: { nombre: true } }, lat: true, lng: true },
        });
    }
}
