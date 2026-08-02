/**
 * SPEC-142 (F6): repositorio de PatronInstitucional — agregado SIN PII por
 * (colegio, período, grado, conducta, plataforma). Tenant obligatorio por
 * construcción (SPEC-134: `colegioId` en toda firma). Acepta un cliente
 * transaccional opcional (D2). El k-anonimato NO se aplica aquí: es de lectura.
 */
import type { CategoriaConducta, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export interface DimensionesPatron {
    periodo: string;
    grado: string;
    conducta: CategoriaConducta;
    plataformaId: string;
}

export class PatronInstitucionalRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Upsert del agregado + incremento atómico del conteo (dentro de la tx del disparo). */
    upsertIncrementar(colegioId: string, dims: DimensionesPatron) {
        return this.db.patronInstitucional.upsert({
            where: {
                colegioId_periodo_grado_conducta_plataformaId: {
                    colegioId,
                    periodo: dims.periodo,
                    grado: dims.grado,
                    conducta: dims.conducta,
                    plataformaId: dims.plataformaId,
                },
            },
            create: {
                colegioId,
                periodo: dims.periodo,
                grado: dims.grado,
                conducta: dims.conducta,
                plataformaId: dims.plataformaId,
                conteo: 1,
            },
            update: { conteo: { increment: 1 } },
        });
    }

    /** Reversa exacta en baja (FR-004): decremento con piso 0, atómico. */
    async decrementarConPiso(id: string): Promise<void> {
        await this.db.$executeRaw`
            UPDATE "patrones_institucionales"
            SET conteo = GREATEST(conteo - 1, 0), "actualizadoEn" = NOW()
            WHERE id = ${id}
        `;
    }

    /** Filas crudas del período del colegio (la regla de k se aplica en el servicio). */
    findPorPeriodo(colegioId: string, periodo: string) {
        return this.db.patronInstitucional.findMany({
            where: { colegioId, periodo },
        });
    }

    /** Total del colegio en un período (tendencia vs. período anterior). */
    async totalPorPeriodo(colegioId: string, periodo: string): Promise<number> {
        const agg = await this.db.patronInstitucional.aggregate({
            where: { colegioId, periodo },
            _sum: { conteo: true },
        });
        return agg._sum.conteo ?? 0;
    }
}
