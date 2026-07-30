/**
 * SPEC-053 (US3, módulo IA): repositorio de CasoEval (banco de casos de
 * evaluación del clasificador). Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_CREADOR = {
    creadoPor: { select: { email: true, nombre: true } },
} satisfies Prisma.CasoEvalInclude;

export type CasoEvalConCreador = Prisma.CasoEvalGetPayload<{ include: typeof INCLUDE_CREADOR }>;

export class CasoEvalRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Listado paginado del banco de casos (con creador): items + total en una pasada. */
    findPaginadosConTotal(
        where: Prisma.CasoEvalWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<[CasoEvalConCreador[], number]> {
        return Promise.all([
            this.db.casoEval.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: INCLUDE_CREADOR,
            }),
            this.db.casoEval.count({ where }),
        ]);
    }

    /** Conteo de casos ACTIVOS por categoría esperada (panel del banco). */
    groupByCategoriaActivos() {
        return this.db.casoEval.groupBy({
            by: ["categoriaEsperada"],
            where: { activo: true },
            orderBy: { categoriaEsperada: "asc" },
            _count: { categoriaEsperada: true },
        });
    }

    /** Siguiente fixtureVersion global (máx actual + 1; 1 si el banco está vacío). */
    async nextFixtureVersion(): Promise<number> {
        const rows = await this.db.casoEval.findMany({ orderBy: { fixtureVersion: "desc" }, take: 1 });
        return (rows[0]?.fixtureVersion ?? 0) + 1;
    }

    crear(data: Prisma.CasoEvalUncheckedCreateInput) {
        return this.db.casoEval.create({ data });
    }

    findById(id: string) {
        return this.db.casoEval.findUnique({ where: { id } });
    }

    actualizar(id: string, data: Prisma.CasoEvalUncheckedUpdateInput) {
        return this.db.casoEval.update({ where: { id }, data });
    }

    /** Casos activos (guarda "hay casos para evaluar" de evals y experimentos). */
    countActivos() {
        return this.db.casoEval.count({ where: { activo: true } });
    }
}
