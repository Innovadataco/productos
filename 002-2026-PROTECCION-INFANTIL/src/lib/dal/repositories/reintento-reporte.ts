/**
 * SPEC-053 (FR-001): repositorio de ReintentoReporte.
 * Encapsula el CRUD de reintentos delegando en `src/lib/reporte-reintentos.ts`.
 * Acepta un cliente transaccional opcional (D2).
 */
import { guardarReintento, contarReintentos, obtenerReintentos, type GuardarReintentoParams } from "@/lib/reporte-reintentos";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class ReintentoReporteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    guardar(params: GuardarReintentoParams) {
        return guardarReintento(params);
    }

    contar(reporteId: string) {
        return contarReintentos(reporteId);
    }

    findByReporteId(reporteId: string) {
        return obtenerReintentos(reporteId);
    }
}
