/**
 * E-8 (002-PI-056): repositorio de DatasetEntrenamiento.
 * Regla dura preservada en la lectura: el listado solo expone registros cuyo
 * texto fue anonimizado (el conteo total sí es visible para métricas).
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_CORRECCION = {
    correccion: {
        select: {
            categoriaOriginal: true,
            categoriaCorregida: true,
        },
    },
} satisfies Prisma.DatasetEntrenamientoInclude;

export class DatasetEntrenamientoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Listado paginado SOLO de registros anonimizados (con la corrección origen). */
    listarAnonimizadosPaginados(paginacion: { skip: number; take: number }) {
        return this.db.datasetEntrenamiento.findMany({
            where: { textoAnonimizado: true },
            orderBy: { creadoEn: "desc" },
            skip: paginacion.skip,
            take: paginacion.take,
            include: INCLUDE_CORRECCION,
        });
    }

    contarTodos(): Promise<number> {
        return this.db.datasetEntrenamiento.count();
    }

    contarAnonimizados(): Promise<number> {
        return this.db.datasetEntrenamiento.count({ where: { textoAnonimizado: true } });
    }

    crear(data: Prisma.DatasetEntrenamientoUncheckedCreateInput) {
        return this.db.datasetEntrenamiento.create({ data });
    }
}
