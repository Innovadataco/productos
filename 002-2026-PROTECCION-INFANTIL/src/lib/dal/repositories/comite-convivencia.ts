/**
 * SPEC-168 (Fase F): repositorio de la cuenta compartida del Comité de
 * Convivencia de un colegio. Una cuenta por colegio (`Usuario.comiteColegioId` único).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class ComiteConvivenciaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    obtenerPorColegio(colegioId: string) {
        return this.db.usuario.findUnique({
            where: { comiteColegioId: colegioId },
            select: {
                id: true,
                email: true,
                estado: true,
                debeCambiarPassword: true,
                ultimaSesion: true,
                creadoEn: true,
            },
        });
    }

    obtenerPorId(id: string) {
        return this.db.usuario.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                estado: true,
                debeCambiarPassword: true,
                ultimaSesion: true,
                creadoEn: true,
                comiteColegioId: true,
            },
        });
    }

    obtenerPorEmail(email: string) {
        return this.db.usuario.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true },
        });
    }

    crear(data: Prisma.UsuarioUncheckedCreateInput) {
        return this.db.usuario.create({
            data,
            select: {
                id: true,
                email: true,
                estado: true,
                debeCambiarPassword: true,
                ultimaSesion: true,
                creadoEn: true,
            },
        });
    }

    actualizarPassword(id: string, passwordHash: string) {
        return this.db.usuario.update({
            where: { id },
            data: { passwordHash, debeCambiarPassword: true },
            select: {
                id: true,
                email: true,
                estado: true,
                debeCambiarPassword: true,
                ultimaSesion: true,
                creadoEn: true,
            },
        });
    }
}
