/**
 * SPEC-053 (data-model §1.4): repositorio de TokenRecuperacion.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class TokenRecuperacionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Tokens activos (no usados, no expirados) creados desde `desde` para un email. */
    countActivosRecientes(email: string, desde: Date) {
        return this.db.tokenRecuperacion.count({
            where: { email, creadoEn: { gte: desde }, usado: false, expiraEn: { gt: new Date() } },
        });
    }

    /** Invalida los tokens previos no usados de un email. */
    invalidarNoUsados(email: string) {
        return this.db.tokenRecuperacion.updateMany({
            where: { email, usado: false },
            data: { usado: true },
        });
    }

    crear(data: Prisma.TokenRecuperacionUncheckedCreateInput) {
        return this.db.tokenRecuperacion.create({ data });
    }

    /** Últimos 50 tokens activos (validación por comparación de hash). */
    findActivos() {
        return this.db.tokenRecuperacion.findMany({
            where: { usado: false, expiraEn: { gt: new Date() } },
            orderBy: { creadoEn: "desc" },
            take: 50,
        });
    }

    /** Últimos 50 tokens activos con el usuario incluido (restablecer contraseña). */
    findActivosConUsuario() {
        return this.db.tokenRecuperacion.findMany({
            where: { usado: false, expiraEn: { gt: new Date() } },
            orderBy: { creadoEn: "desc" },
            take: 50,
            include: { usuario: true },
        });
    }

    marcarUsado(id: string) {
        return this.db.tokenRecuperacion.update({ where: { id }, data: { usado: true } });
    }
}
