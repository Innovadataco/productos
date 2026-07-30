/**
 * SPEC-053 (US3, módulo Apelaciones): repositorio de Apelacion.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const SELECT_MIAS = {
    id: true,
    numero: true,
    identificador: true,
    estado: true,
    esRepresentante: true,
    creadoEn: true,
    plazoRespuestaEn: true,
    decision: true,
    motivacionResolucion: true,
    resueltoEn: true,
    plataformaId: true,
    plataforma: { select: { nombre: true, clave: true } },
    documentos: { select: { nombreOriginal: true, eliminadoEn: true } },
} satisfies Prisma.ApelacionSelect;

export type ApelacionMiaRow = Prisma.ApelacionGetPayload<{ select: typeof SELECT_MIAS }>;

export class ApelacionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Apelación abierta (RECIBIDA/EN_REVISION) del usuario para el identificador. */
    findAbierta(usuarioId: string, identificador: string, plataformaId: string) {
        return this.db.apelacion.findFirst({
            where: { usuarioId, identificador, plataformaId, estado: { in: ["RECIBIDA", "EN_REVISION"] } },
            select: { id: true },
        });
    }

    /** Crea la apelación con su documento de evidencia (nested create). */
    crearConDocumento(data: Prisma.ApelacionCreateInput) {
        return this.db.apelacion.create({
            data,
            select: { id: true, numero: true, estado: true, plazoRespuestaEn: true, creadoEn: true },
        });
    }

    /** Lista paginada del usuario (conteo incluido), con plataforma y documento. */
    findPaginadasPorUsuario(usuarioId: string, paginacion: { skip: number; take: number }): Promise<[ApelacionMiaRow[], number]> {
        const where = { usuarioId };
        return Promise.all([
            this.db.apelacion.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                select: SELECT_MIAS,
            }),
            this.db.apelacion.count({ where }),
        ]);
    }
}
