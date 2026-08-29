/**
 * SPEC-053 (US3, módulo IA): repositorio de SimulacionRun (corridas de
 * simulación sobre bancos de casos). Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_CREADOR = {
    creadoPor: { select: { email: true, nombre: true } },
} satisfies Prisma.SimulacionRunInclude;

export type SimulacionRunConCreador = Prisma.SimulacionRunGetPayload<{ include: typeof INCLUDE_CREADOR }>;

export class SimulacionRunRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Simulación activa (PENDIENTE o EN_PROGRESO), si existe — guarda de corrida única. */
    findEnProgreso() {
        return this.db.simulacionRun.findFirst({
            where: { estado: { in: ["PENDIENTE", "EN_PROGRESO"] } },
        });
    }

    crear(data: Prisma.SimulacionRunUncheckedCreateInput) {
        return this.db.simulacionRun.create({ data });
    }

    findById(id: string) {
        return this.db.simulacionRun.findUnique({ where: { id } });
    }

    findByIdConCreador(id: string): Promise<SimulacionRunConCreador | null> {
        return this.db.simulacionRun.findUnique({ where: { id }, include: INCLUDE_CREADOR });
    }

    /** Listado paginado de corridas (con creador): items + total en una pasada. */
    findPaginadosConTotal(
        where: Prisma.SimulacionRunWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<[SimulacionRunConCreador[], number]> {
        return Promise.all([
            this.db.simulacionRun.findMany({
                where,
                orderBy: { fechaInicio: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: INCLUDE_CREADOR,
            }),
            this.db.simulacionRun.count({ where }),
        ]);
    }

    /** Corridas por ids (comparación), más antiguas primero. */
    findPorIds(ids: string[]) {
        return this.db.simulacionRun.findMany({
            where: { id: { in: ids } },
            orderBy: { fechaInicio: "asc" },
        });
    }

    /** Cancelación: estado CANCELADA con fecha de fin. */
    cancelar(id: string) {
        return this.db.simulacionRun.update({
            where: { id },
            data: { estado: "CANCELADA", fechaFin: new Date() },
        });
    }

    /** E-8: solo el estado (chequeo de cancelación entre batches del executor). */
    findEstado(id: string) {
        return this.db.simulacionRun.findUnique({
            where: { id },
            select: { estado: true },
        });
    }

    /** E-8: actualización genérica de la corrida (arranque, cierre, métricas). */
    actualizar(id: string, data: Prisma.SimulacionRunUncheckedUpdateInput) {
        return this.db.simulacionRun.update({ where: { id }, data });
    }
}
