/**
 * SPEC-053 (data-model §1.4): repositorio de Usuario.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class UsuarioRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByEmail(email: string) {
        return this.db.usuario.findUnique({ where: { email } });
    }

    findById(id: string) {
        return this.db.usuario.findUnique({ where: { id } });
    }

    crear(data: Prisma.UsuarioUncheckedCreateInput) {
        return this.db.usuario.create({ data });
    }

    actualizar(id: string, data: Prisma.UsuarioUncheckedUpdateInput) {
        return this.db.usuario.update({ where: { id }, data });
    }
}
