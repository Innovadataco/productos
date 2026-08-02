/**
 * SPEC-053 (US3, módulo IA): repositorio de EvalResultado (resultado por caso
 * de cada corrida/experimento). Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_CASO = {
    casoEval: { select: { texto: true, ruido: true } },
} satisfies Prisma.EvalResultadoInclude;

export type EvalResultadoConCaso = Prisma.EvalResultadoGetPayload<{ include: typeof INCLUDE_CASO }>;

export class EvalResultadoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Resultados paginados de un experimento (con texto/ruido del caso): items + total. */
    findPaginadosConTotal(
        where: Prisma.EvalResultadoWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<[EvalResultadoConCaso[], number]> {
        return Promise.all([
            this.db.evalResultado.findMany({
                where,
                orderBy: { creadoEn: "asc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: INCLUDE_CASO,
            }),
            this.db.evalResultado.count({ where }),
        ]);
    }

    /** Aciertos por caso de varios experimentos (fronteras de la comparación). */
    findCorrectosPorExperimentos(experimentoIds: string[]) {
        return this.db.evalResultado.findMany({
            where: { experimentoId: { in: experimentoIds } },
            select: { experimentoId: true, casoEvalId: true, correcto: true, esperado: true, predicho: true },
        });
    }

    /** E-8: resultados de una corrida en lote (persistEvalRun, dentro de su tx). */
    crearMuchos(data: Prisma.EvalResultadoCreateManyInput[]) {
        return this.db.evalResultado.createMany({ data });
    }
}
