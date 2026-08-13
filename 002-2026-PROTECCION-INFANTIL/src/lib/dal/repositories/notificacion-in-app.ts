/**
 * SPEC-169 (Fase G): repositorio de NotificacionInApp — bandeja del rector.
 * Todo acceso exige `colegioId` (tenant-first E-1 / SPEC-134).
 * Estados implícitos: no leída (leidaEn IS NULL), archivada (archivadaEn IS NOT NULL).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export type TipoNotificacionInApp = "ALERTA_NUEVA" | "ALERTA_GESTIONADA" | "ALERTA_ESCALADA" | "SISTEMA";

export interface FiltroNotificaciones {
    page: number;
    pageSize: number;
    soloNoLeidas?: boolean | undefined;
}

export class NotificacionInAppRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    private baseWhere(colegioId: string, usuarioId: string, soloNoLeidas?: boolean): Prisma.NotificacionInAppWhereInput {
        return {
            colegioId,
            usuarioId,
            archivadaEn: null,
            ...(soloNoLeidas ? { leidaEn: null } : {}),
        };
    }

    async listar(colegioId: string, usuarioId: string, filtros: FiltroNotificaciones) {
        const where = this.baseWhere(colegioId, usuarioId, filtros.soloNoLeidas);
        const [items, total] = await Promise.all([
            this.db.notificacionInApp.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: (filtros.page - 1) * filtros.pageSize,
                take: filtros.pageSize,
            }),
            this.db.notificacionInApp.count({ where }),
        ]);
        return { items, total, page: filtros.page, pageSize: filtros.pageSize };
    }

    contarNoLeidas(colegioId: string, usuarioId: string): Promise<number> {
        return this.db.notificacionInApp.count({
            where: {
                colegioId,
                usuarioId,
                archivadaEn: null,
                leidaEn: null,
            },
        });
    }

    async marcarLeida(colegioId: string, usuarioId: string, id: string): Promise<number> {
        const { count } = await this.db.notificacionInApp.updateMany({
            where: {
                id,
                colegioId,
                usuarioId,
                archivadaEn: null,
            },
            data: { leidaEn: new Date() },
        });
        return count;
    }

    async marcarTodasLeidas(colegioId: string, usuarioId: string): Promise<number> {
        const { count } = await this.db.notificacionInApp.updateMany({
            where: {
                colegioId,
                usuarioId,
                archivadaEn: null,
                leidaEn: null,
            },
            data: { leidaEn: new Date() },
        });
        return count;
    }

    async archivar(colegioId: string, usuarioId: string, id: string): Promise<number> {
        const { count } = await this.db.notificacionInApp.updateMany({
            where: {
                id,
                colegioId,
                usuarioId,
                archivadaEn: null,
            },
            data: { archivadaEn: new Date() },
        });
        return count;
    }

    crear(
        data: {
            colegioId: string;
            usuarioId: string;
            tipo: TipoNotificacionInApp;
            titulo: string;
            mensaje: string;
            entidadId?: string;
        },
        tx?: Prisma.TransactionClient
    ) {
        const db = tx ?? this.db;
        return db.notificacionInApp.create({
            data: {
                colegioId: data.colegioId,
                usuarioId: data.usuarioId,
                tipo: data.tipo,
                titulo: data.titulo,
                mensaje: data.mensaje,
                ...(data.entidadId ? { entidadId: data.entidadId } : {}),
            },
        });
    }
}
