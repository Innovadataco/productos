/**
 * SPEC-053 (data-model §1.3): repositorio de ParametroSistema.
 * `src/lib/parametros.ts` se conserva como servicio de lectura/caché; este
 * repositorio cubre las lecturas directas que las rutas hacían con prisma.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class ParametroRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByClave(clave: string) {
        return this.db.parametroSistema.findUnique({ where: { clave } });
    }
}
