/**
 * SPEC-053 (US3, módulo Operadores): repositorio de PerfilOperador.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class PerfilOperadorRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    actualizarPorUsuarioId(usuarioId: string, data: Prisma.PerfilOperadorUpdateInput) {
        return this.db.perfilOperador.update({ where: { usuarioId }, data });
    }
}
