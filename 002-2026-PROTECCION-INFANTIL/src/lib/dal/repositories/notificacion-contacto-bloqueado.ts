/**
 * SPEC-201 (BRIEF §5.5): repositorio de NotificacionContactoBloqueado.
 * Gestiona destinos con bounces reiterados.
 */
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";
import type { Prisma } from "@prisma/client";

export class NotificacionContactoBloqueadoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByEmail(email: string) {
        return this.db.notificacionContactoBloqueado.findUnique({ where: { email } });
    }

    async estaBloqueado(email: string): Promise<boolean> {
        const count = await this.db.notificacionContactoBloqueado.count({ where: { email } });
        return count > 0;
    }

    /**
     * Incrementa el contador de bounces de un email. Si no existe, lo crea.
     * Devuelve el registro actualizado.
     */
    async incrementarBounce(
        email: string,
        motivo: string,
        tx?: Prisma.TransactionClient
    ) {
        const db = tx ?? this.db;
        const existente = await db.notificacionContactoBloqueado.findUnique({ where: { email } });
        if (existente) {
            return db.notificacionContactoBloqueado.update({
                where: { email },
                data: {
                    bounceCount: { increment: 1 },
                    ultimoBounce: new Date(),
                    motivo,
                },
            });
        }
        return db.notificacionContactoBloqueado.create({
            data: {
                email,
                bounceCount: 1,
                ultimoBounce: new Date(),
                motivo,
            },
        });
    }

    marcarNotificadoAdmin(email: string) {
        return this.db.notificacionContactoBloqueado.update({
            where: { email },
            data: { notificadoAdminEn: new Date() },
        });
    }

    crear(email: string, motivo: string) {
        return this.db.notificacionContactoBloqueado.create({
            data: {
                email,
                motivo,
                bounceCount: 1,
                ultimoBounce: new Date(),
            },
        });
    }
}
