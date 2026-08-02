/**
 * SPEC-053 (FR-001): repositorio de TransicionReporte.
 * Encapsula el registro de transiciones de estado delegando en
 * `src/lib/reporte-transiciones.ts` (que ya acepta `tx` y centraliza la
 * escritura). Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { registrarTransicion, type RegistrarTransicionParams } from "@/lib/reporte-transiciones";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class TransicionReporteRepository {
    private readonly db: DbClient;
    private readonly tx: Prisma.TransactionClient | undefined;

    constructor(tx?: Prisma.TransactionClient) {
        this.tx = tx;
        this.db = tx ?? prisma;
    }

    /** Registra un cambio de estado. Si hay tx inyectada, la comparte (D2). */
    registrar(params: Omit<RegistrarTransicionParams, "tx">) {
        return registrarTransicion({ ...params, tx: this.tx });
    }

    findByReporteId(reporteId: string) {
        return this.db.transicionReporte.findMany({
            where: { reporteId },
            orderBy: { creadoEn: "asc" },
        });
    }
}
