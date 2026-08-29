/**
 * SPEC-053 (data-model §1.4): repositorio de CodigoVerificacion.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class CodigoVerificacionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Códigos no usados creados desde `desde` (rate-limit de códigos por email). */
    countRecientes(email: string, desde: Date) {
        return this.db.codigoVerificacion.count({
            where: { email, creadoEn: { gte: desde }, usado: false },
        });
    }

    crear(data: Prisma.CodigoVerificacionUncheckedCreateInput) {
        return this.db.codigoVerificacion.create({ data });
    }

    /** Último código no usado de un email (validación por comparación de hash). */
    findUltimoNoUsado(email: string) {
        return this.db.codigoVerificacion.findFirst({
            where: { email, usado: false },
            orderBy: { creadoEn: "desc" },
        });
    }

    incrementarIntentos(id: string) {
        return this.db.codigoVerificacion.update({
            where: { id },
            data: { intentosFallidos: { increment: 1 } },
        });
    }

    marcarUsado(id: string) {
        return this.db.codigoVerificacion.update({ where: { id }, data: { usado: true } });
    }
}
