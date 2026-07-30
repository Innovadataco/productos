/**
 * SPEC-053 (FR-001): repositorio de IdentificadorReportado.
 * Encapsula el upsert de agregación y las lecturas de visibilidad pública;
 * acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class IdentificadorReportadoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByPar(identificador: string, plataformaId: string) {
        return this.db.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId } },
        });
    }

    /**
     * Claves `identificador::plataformaId` de los identificadores visibles
     * públicamente entre los pares dados (para decorar listados con ranking).
     */
    async findClavesVisibles(pares: Array<{ identificador: string; plataformaId: string }>): Promise<Set<string>> {
        if (pares.length === 0) return new Set();
        const rows = await this.db.identificadorReportado.findMany({
            where: {
                identificador: { in: pares.map((p) => p.identificador) },
                plataformaId: { in: pares.map((p) => p.plataformaId) },
                esVisiblePublicamente: true,
            },
            select: { identificador: true, plataformaId: true },
        });
        return new Set(rows.map((i) => `${i.identificador}::${i.plataformaId}`));
    }

    /**
     * Upsert de agregación al crear un reporte (SPEC-110: un reporte NUEVO
     * levanta el ocultamiento por comité, sin lista blanca permanente).
     */
    upsertIncrementoReporte(input: { identificador: string; plataformaId: string; esAnonimo: boolean }) {
        const { identificador, plataformaId, esAnonimo } = input;
        return this.db.identificadorReportado.upsert({
            where: { identificador_plataformaId: { identificador, plataformaId } },
            update: {
                totalReportes: { increment: 1 },
                reportesAutenticados: esAnonimo ? undefined : { increment: 1 },
                reportesAnonimos: esAnonimo ? { increment: 1 } : undefined,
                ultimoReporteEn: new Date(),
                ocultoPorComiteEn: null,
            },
            create: {
                identificador,
                plataformaId,
                totalReportes: 1,
                reportesAutenticados: esAnonimo ? 0 : 1,
                reportesAnonimos: esAnonimo ? 1 : 0,
                ultimoReporteEn: new Date(),
            },
        });
    }
}
