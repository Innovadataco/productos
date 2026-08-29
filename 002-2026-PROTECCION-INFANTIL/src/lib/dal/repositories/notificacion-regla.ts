/**
 * SPEC-201 (BRIEF §5.3): repositorio de NotificacionRegla.
 */
import { prisma } from "../../prisma";
import type { DbClient } from "../unit-of-work";
import type { CanalNotificacion, Prisma } from "@prisma/client";

export type ReglaCreateInput = {
    evento: string;
    rol: string;
    offset: string;
    canal: CanalNotificacion;
    plantillaClave: string;
    obligatoria?: boolean;
    activa?: boolean;
    actualizadaPor?: string | null;
};

export type ReglaUpdateInput = {
    offset?: string;
    canal?: CanalNotificacion;
    plantillaClave?: string;
    obligatoria?: boolean;
    activa?: boolean;
    actualizadaPor?: string | null;
};

export class NotificacionReglaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findById(id: string) {
        return this.db.notificacionRegla.findUnique({ where: { id } });
    }

    findByEvento(evento: string) {
        return this.db.notificacionRegla.findMany({ where: { evento } });
    }

    findByEventoActivo(evento: string) {
        return this.db.notificacionRegla.findMany({ where: { evento, activa: true } });
    }

    listarActivas() {
        return this.db.notificacionRegla.findMany({ where: { activa: true } });
    }

    /** SPEC-202 (002-PI-099): listado completo para el admin (activas e inactivas). */
    listarTodas() {
        return this.db.notificacionRegla.findMany({ orderBy: [{ evento: "asc" }, { canal: "asc" }, { rol: "asc" }] });
    }

    crear(data: ReglaCreateInput) {
        return this.db.notificacionRegla.create({
            data: {
                evento: data.evento,
                rol: data.rol,
                offset: data.offset,
                canal: data.canal,
                plantillaClave: data.plantillaClave,
                obligatoria: data.obligatoria ?? false,
                activa: data.activa ?? true,
                actualizadaPor: data.actualizadaPor ?? null,
            },
        });
    }

    actualizar(id: string, data: ReglaUpdateInput) {
        return this.db.notificacionRegla.update({
            where: { id },
            data: {
                ...(data.offset !== undefined ? { offset: data.offset } : {}),
                ...(data.canal !== undefined ? { canal: data.canal } : {}),
                ...(data.plantillaClave !== undefined ? { plantillaClave: data.plantillaClave } : {}),
                ...(data.obligatoria !== undefined ? { obligatoria: data.obligatoria } : {}),
                ...(data.activa !== undefined ? { activa: data.activa } : {}),
                ...(data.actualizadaPor !== undefined ? { actualizadaPor: data.actualizadaPor } : {}),
            },
        });
    }

    /**
     * Busca una regla existente por (evento, rol, canal) para decidir create/update.
     * El schema no declara @@unique sobre estos tres campos porque una regla puede
     * evolucionar a inactiva; el seed mantiene una sola activa por (evento, rol, canal).
     */
    findByEventoRolCanal(evento: string, rol: string, canal: CanalNotificacion) {
        return this.db.notificacionRegla.findFirst({
            where: { evento, rol, canal },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });
    }
}
