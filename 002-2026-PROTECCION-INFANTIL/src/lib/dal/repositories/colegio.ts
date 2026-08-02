/**
 * SPEC-134 (E-1): repositorio de Colegio — tenant obligatorio por construcción.
 * Excepción documentada del diseño tenant-first: aquí el tenant ES el propio id
 * del colegio (regla 4 del plan). Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const SELECT_VIGENCIA = {
    id: true,
    estado: true,
    inicioServicio: true,
    finServicio: true,
} satisfies Prisma.ColegioSelect;

const SELECT_RESUMEN = {
    id: true,
    nombre: true,
} satisfies Prisma.ColegioSelect;

const INCLUDE_UBICACION = {
    pais: { select: { id: true, nombre: true } },
    departamento: { select: { id: true, nombre: true } },
    ciudad: { select: { id: true, nombre: true } },
} satisfies Prisma.ColegioInclude;

export type ColegioVigenciaRow = Prisma.ColegioGetPayload<{ select: typeof SELECT_VIGENCIA }>;
export type ColegioResumenRow = Prisma.ColegioGetPayload<{ select: typeof SELECT_RESUMEN }>;
export type ColegioConUbicacion = Prisma.ColegioGetPayload<{ include: typeof INCLUDE_UBICACION }>;

export class ColegioRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Ventana de servicio del colegio (vigencia.ts). Null si no existe. */
    obtenerVigencia(colegioId: string): Promise<ColegioVigenciaRow | null> {
        return this.db.colegio.findUnique({
            where: { id: colegioId },
            select: SELECT_VIGENCIA,
        });
    }

    /** Resumen mínimo para estadísticas (id + nombre). Null si no existe. */
    obtenerResumen(colegioId: string): Promise<ColegioResumenRow | null> {
        return this.db.colegio.findUnique({
            where: { id: colegioId },
            select: SELECT_RESUMEN,
        });
    }

    /** Colegio con su ubicación (GET /api/me/colegio). Null si no existe. */
    obtenerConUbicacion(colegioId: string): Promise<ColegioConUbicacion | null> {
        return this.db.colegio.findUnique({
            where: { id: colegioId },
            include: INCLUDE_UBICACION,
        });
    }
}
