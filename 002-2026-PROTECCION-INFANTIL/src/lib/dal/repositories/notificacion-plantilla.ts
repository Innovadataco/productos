/**
 * SPEC-201 (BRIEF §5.2): repositorio de NotificacionPlantilla.
 */
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";
import type { CanalNotificacion, Prisma } from "@prisma/client";

export type PlantillaCreateInput = {
    clave: string;
    canal: CanalNotificacion;
    asunto?: string | null;
    cuerpoMarkdown: string;
    variablesSchema?: Prisma.InputJsonValue;
    activa?: boolean;
    creadaPor?: string | null;
};

export type PlantillaUpdateInput = {
    asunto?: string | null;
    cuerpoMarkdown?: string;
    variablesSchema?: Prisma.InputJsonValue;
    activa?: boolean;
    actualizadaPor?: string | null;
};

export class NotificacionPlantillaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByClave(clave: string) {
        return this.db.notificacionPlantilla.findUnique({ where: { clave } });
    }

    findByClaveYCanal(clave: string, canal: CanalNotificacion) {
        return this.db.notificacionPlantilla.findFirst({ where: { clave, canal } });
    }

    listarActivas() {
        return this.db.notificacionPlantilla.findMany({ where: { activa: true } });
    }

    /** SPEC-202 (002-PI-099): listado completo para el admin (activas e inactivas). */
    listarTodas() {
        return this.db.notificacionPlantilla.findMany({ orderBy: { clave: "asc" } });
    }

    crear(data: PlantillaCreateInput) {
        return this.db.notificacionPlantilla.create({
            data: {
                clave: data.clave,
                canal: data.canal,
                asunto: data.asunto ?? null,
                cuerpoMarkdown: data.cuerpoMarkdown,
                variablesSchema: data.variablesSchema ?? {},
                activa: data.activa ?? true,
                creadaPor: data.creadaPor ?? null,
            },
        });
    }

    actualizar(clave: string, data: PlantillaUpdateInput) {
        return this.db.notificacionPlantilla.update({
            where: { clave },
            data: {
                ...(data.asunto !== undefined ? { asunto: data.asunto } : {}),
                ...(data.cuerpoMarkdown !== undefined ? { cuerpoMarkdown: data.cuerpoMarkdown } : {}),
                ...(data.variablesSchema !== undefined ? { variablesSchema: data.variablesSchema } : {}),
                ...(data.activa !== undefined ? { activa: data.activa } : {}),
                ...(data.actualizadaPor !== undefined ? { actualizadaPor: data.actualizadaPor } : {}),
                version: { increment: 1 },
            },
        });
    }

    /**
     * Upsert idempotente. El `update` es explícito para cada campo sembrado,
     * siguiendo el patrón I-100 / SPEC-190: cuando la estructura de la
     * plantilla cambie entre versiones, el seed debe forzar la actualización.
     */
    upsert(clave: string, data: PlantillaCreateInput) {
        return this.db.notificacionPlantilla.upsert({
            where: { clave },
            update: {
                canal: data.canal,
                asunto: data.asunto ?? null,
                cuerpoMarkdown: data.cuerpoMarkdown,
                variablesSchema: data.variablesSchema ?? {},
                activa: data.activa ?? true,
                actualizadaPor: data.creadaPor ?? null,
            },
            create: {
                clave: data.clave,
                canal: data.canal,
                asunto: data.asunto ?? null,
                cuerpoMarkdown: data.cuerpoMarkdown,
                variablesSchema: data.variablesSchema ?? {},
                activa: data.activa ?? true,
                creadaPor: data.creadaPor ?? null,
            },
        });
    }
}
