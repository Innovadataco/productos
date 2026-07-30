/**
 * SPEC-053 (US3, módulo Comité): repositorio de IntegranteComite (padrón de
 * integrantes del comité de validación; `numeroIdentificacion` viaja cifrado —
 * el cifrado/descifrado lo hace el servicio). Acepta tx opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export type IntegranteComiteConComite = Prisma.IntegranteComiteGetPayload<{ include: { comite: true } }>;

export class IntegranteComiteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Padrón de un comité, más recientes primero. */
    findPorComite(comiteId: string) {
        return this.db.integranteComite.findMany({
            where: { comiteId },
            orderBy: { creadoEn: "desc" },
        });
    }

    /** Integrante con su comité (validación de pertenencia en PATCH/DELETE). */
    findByIdConComite(id: string): Promise<IntegranteComiteConComite | null> {
        return this.db.integranteComite.findUnique({
            where: { id },
            include: { comite: true },
        });
    }

    crear(data: Prisma.IntegranteComiteUncheckedCreateInput) {
        return this.db.integranteComite.create({ data });
    }

    actualizar(id: string, data: Prisma.IntegranteComiteUncheckedUpdateInput) {
        return this.db.integranteComite.update({ where: { id }, data });
    }
}
