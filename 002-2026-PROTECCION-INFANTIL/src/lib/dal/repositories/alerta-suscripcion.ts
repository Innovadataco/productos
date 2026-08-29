/**
 * SPEC-053 (US3, módulo Alertas): repositorio de AlertaSuscripcion.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_PLATAFORMA = {
    plataforma: { select: { id: true, nombre: true, clave: true } },
} satisfies Prisma.AlertaSuscripcionInclude;

export class AlertaSuscripcionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findActivasPorUsuario(usuarioId: string) {
        return this.db.alertaSuscripcion.findMany({
            where: { usuarioId, activa: true },
            include: INCLUDE_PLATAFORMA,
            orderBy: { creadoEn: "desc" },
        });
    }

    findById(id: string) {
        return this.db.alertaSuscripcion.findUnique({ where: { id } });
    }

    /** Crea o reactiva la suscripción del usuario al identificador. */
    upsertActivar(input: { usuarioId: string; identificador: string; plataformaId: string }) {
        const { usuarioId, identificador, plataformaId } = input;
        return this.db.alertaSuscripcion.upsert({
            where: { usuarioId_identificador_plataformaId: { usuarioId, identificador, plataformaId } },
            update: { activa: true },
            create: { usuarioId, identificador, plataformaId, activa: true },
            include: INCLUDE_PLATAFORMA,
        });
    }

    desactivar(id: string) {
        return this.db.alertaSuscripcion.update({ where: { id }, data: { activa: false } });
    }
}
