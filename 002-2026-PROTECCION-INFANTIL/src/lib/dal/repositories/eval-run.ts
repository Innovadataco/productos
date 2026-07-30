/**
 * SPEC-053 (US3, módulo IA): repositorio de EvalRun (corridas de evaluación f7
 * y experimentos del laboratorio). Encapsula CRUD y búsquedas; acepta un
 * cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { EvalRunEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_CREADOR = {
    creadoPor: { select: { email: true, nombre: true } },
} satisfies Prisma.EvalRunInclude;

export type EvalRunConCreador = Prisma.EvalRunGetPayload<{ include: typeof INCLUDE_CREADOR }>;

export class EvalRunRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Corrida activa (PENDIENTE o EN_PROGRESO), si existe — guarda de corrida única. */
    findEnProgreso() {
        return this.db.evalRun.findFirst({
            where: { estado: { in: [EvalRunEstado.PENDIENTE, EvalRunEstado.EN_PROGRESO] } },
        });
    }

    crear(data: Prisma.EvalRunUncheckedCreateInput) {
        return this.db.evalRun.create({ data });
    }

    findById(id: string) {
        return this.db.evalRun.findUnique({ where: { id } });
    }

    findByIdConCreador(id: string): Promise<EvalRunConCreador | null> {
        return this.db.evalRun.findUnique({ where: { id }, include: INCLUDE_CREADOR });
    }

    /** Corrida COMPLETADA anterior de la misma fixtureVersion (comparación de /evals/[id]). */
    findAnteriorCompletada(fixtureVersion: number, excluirId: string) {
        return this.db.evalRun.findFirst({
            where: { id: { not: excluirId }, fixtureVersion, estado: EvalRunEstado.COMPLETADA },
            orderBy: { finalizadoEn: "desc" },
        });
    }

    /** Baseline: última COMPLETADA de la fixture cuyo configSnapshot iguala producción. */
    findBaseline(fixtureVersion: number, configSnapshot: Prisma.InputJsonValue) {
        return this.db.evalRun.findFirst({
            where: {
                estado: EvalRunEstado.COMPLETADA,
                fixtureVersion,
                configSnapshot: { equals: configSnapshot },
            },
            orderBy: { finalizadoEn: "desc" },
        });
    }

    /** Historial de evaluaciones y listado de experimentos: items + total en una pasada. */
    findPaginadosConTotal(
        where: Prisma.EvalRunWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<[EvalRunConCreador[], number]> {
        return Promise.all([
            this.db.evalRun.findMany({
                where,
                orderBy: { iniciadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: INCLUDE_CREADOR,
            }),
            this.db.evalRun.count({ where }),
        ]);
    }

    /** Experimentos COMPLETADA por ids (comparación), más recientes primero. */
    findCompletadosPorIds(ids: string[]) {
        return this.db.evalRun.findMany({
            where: { id: { in: ids }, estado: EvalRunEstado.COMPLETADA },
            orderBy: { iniciadoEn: "desc" },
        });
    }
}
