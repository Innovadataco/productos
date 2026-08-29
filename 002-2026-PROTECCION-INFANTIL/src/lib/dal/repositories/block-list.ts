/**
 * SPEC-184 (002-PI-079): repositorio de BlockList.
 * Frontera DAL (Q-3): todo acceso a BlockList pasa por aquí.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class BlockListRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Busca una entrada por id de fila. */
    findById(id: string) {
        return this.db.blockList.findUnique({ where: { id } });
    }

    /** Busca una entrada por ipHash (única). */
    findByIpHash(ipHash: string) {
        return this.db.blockList.findUnique({ where: { ipHash } });
    }

    /** Entrada vigente: expiraEn es null o futuro. */
    findVigenteByIpHash(ipHash: string) {
        const ahora = new Date();
        return this.db.blockList.findFirst({
            where: {
                ipHash,
                OR: [{ expiraEn: null }, { expiraEn: { gt: ahora } }],
            },
        });
    }

    /** Listado paginado de bloqueos vigentes. */
    findPaginadosVigentes(
        paginacion: { skip: number; take: number }
    ): Promise<[Prisma.BlockListGetPayload<{}>[], number]> {
        const ahora = new Date();
        const where = {
            OR: [{ expiraEn: null }, { expiraEn: { gt: ahora } }],
        };
        return Promise.all([
            this.db.blockList.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
            }),
            this.db.blockList.count({ where }),
        ]);
    }

    crear(data: Prisma.BlockListUncheckedCreateInput) {
        return this.db.blockList.create({ data });
    }

    eliminar(id: string) {
        return this.db.blockList.delete({ where: { id } });
    }
}
