/**
 * SPEC-339 (A-67): repositorio de TokenRegistro — el enlace de registro del
 * padre. Calcado del patrón de `TokenRecuperacionRepository` (SPEC-053).
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class TokenRegistroRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Tokens activos (no usados, no expirados) creados desde `desde` para un email. */
    countActivosRecientes(email: string, desde: Date) {
        return this.db.tokenRegistro.count({
            where: { email, creadoEn: { gte: desde }, usado: false, expiraEn: { gt: new Date() } },
        });
    }

    /** Invalida los enlaces previos no usados de un email (uno vivo a la vez). */
    invalidarNoUsados(email: string) {
        return this.db.tokenRegistro.updateMany({
            where: { email, usado: false },
            data: { usado: true },
        });
    }

    crear(data: Prisma.TokenRegistroUncheckedCreateInput) {
        return this.db.tokenRegistro.create({ data });
    }

    /** Últimos 50 tokens activos (validación por comparación de hash). */
    findActivos() {
        return this.db.tokenRegistro.findMany({
            where: { usado: false, expiraEn: { gt: new Date() } },
            orderBy: { creadoEn: "desc" },
            take: 50,
        });
    }

    /**
     * El último token de un email, usado o no — para distinguir "ya lo usaste"
     * y "se venció" de "nunca existió" y responder con calma, no con un genérico.
     */
    findUltimoPorEmail(email: string) {
        return this.db.tokenRegistro.findFirst({
            where: { email },
            orderBy: { creadoEn: "desc" },
        });
    }

    marcarUsado(id: string) {
        return this.db.tokenRegistro.update({ where: { id }, data: { usado: true } });
    }
}
