/**
 * SPEC-241 (002-PI-144): repositorio de AuditConsentimiento.
 * Registro inmutable de aceptaciones de consentimiento informado.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import type { DbClient } from "../unit-of-work";

export class ConsentimientoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    crear(data: Prisma.AuditConsentimientoUncheckedCreateInput) {
        return this.db.auditConsentimiento.create({ data });
    }

    findByUsuarioId(usuarioId: string) {
        return this.db.auditConsentimiento.findMany({
            where: { usuarioId },
            orderBy: { aceptadoEn: "desc" },
        });
    }
}
