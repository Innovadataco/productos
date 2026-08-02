/**
 * SPEC-053 (US3, módulo Estadísticas): repositorio de Ciudad (catálogo geográfico).
 * Acepta un cliente transaccional opcional (D2).
 */
import { Prisma } from "@prisma/client";
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

    /** E-8: ciudad por id (validación de ubicación en gestión admin de colegios). */
    findById(id: string) {
        return this.db.ciudad.findUnique({ where: { id } });
    }

    /** GET /api/ciudades: activas del país (filtro opcional por departamento), alfabéticas. */
    listarActivasPorPais(paisId: string, departamentoId?: string) {
        return this.db.ciudad.findMany({
            where: {
                paisId,
                esActivo: true,
                ...(departamentoId ? { departamentoId } : {}),
            },
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true, paisId: true, departamentoId: true },
        });
    }

    /**
     * GET /api/ciudades/buscar (SPEC-115, D3): búsqueda sobre `nombreNormalizado`
     * (ILIKE contiene), prefijo primero y población descendente. La raw query
     * (join con Departamento) vive AQUÍ, nunca en la ruta.
     */
    buscarPorNombreNormalizado(input: {
        paisId: string;
        qNorm: string;
        departamentoId?: string | undefined;
        limit: number;
    }): Promise<CiudadBusquedaRow[]> {
        const contiene = `%${input.qNorm}%`;
        const prefijo = `${input.qNorm}%`;
        return this.db.$queryRaw<CiudadBusquedaRow[]>`
            SELECT c.id, c.nombre, c."paisId", c."departamentoId",
                   d.nombre AS departamento, c.lat, c.lng
            FROM "Ciudad" c
            LEFT JOIN "Departamento" d ON d.id = c."departamentoId"
            WHERE c."paisId" = ${input.paisId}
              AND c."esActivo" = true
              AND c."nombreNormalizado" ILIKE ${contiene}
              ${input.departamentoId ? Prisma.sql`AND c."departamentoId" = ${input.departamentoId}` : Prisma.empty}
            ORDER BY (c."nombreNormalizado" LIKE ${prefijo}) DESC,
                     c.poblacion DESC NULLS LAST,
                     c.nombre ASC
            LIMIT ${input.limit}
        `;
    }
}

export type CiudadBusquedaRow = {
    id: string;
    nombre: string;
    paisId: string;
    departamentoId: string | null;
    departamento: string | null;
    lat: number | null;
    lng: number | null;
};
