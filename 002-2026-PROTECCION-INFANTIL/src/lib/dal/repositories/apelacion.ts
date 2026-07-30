/**
 * SPEC-053 (US3, módulo Apelaciones): repositorio de Apelacion.
 * Incluye la bandeja y el ciclo de vida del comité de validación (SPEC-110).
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

const SELECT_BANDEJA_COMITE = {
    id: true,
    numero: true,
    identificador: true,
    estado: true,
    esRepresentante: true,
    creadoEn: true,
    plazoRespuestaEn: true,
    resueltoEn: true,
    decision: true,
    plataforma: { select: { nombre: true, clave: true } },
    usuario: { select: { id: true, nombre: true, email: true } },
    comite: { select: { id: true, nombre: true } },
} satisfies Prisma.ApelacionSelect;

const INCLUDE_DETALLE_COMITE = {
    plataforma: { select: { nombre: true, clave: true } },
    usuario: { select: { id: true, nombre: true, email: true } },
    comite: { select: { id: true, nombre: true } },
    resueltoPor: { select: { id: true, nombre: true } },
    documentos: {
        include: {
            accesos: {
                orderBy: { accedidoEn: "desc" },
                include: { usuario: { select: { id: true, nombre: true, email: true } } },
            },
        },
    },
} satisfies Prisma.ApelacionInclude;

export type ApelacionMiaRow = Prisma.ApelacionGetPayload<{ select: typeof SELECT_MIAS }>;
export type ApelacionBandejaComiteRow = Prisma.ApelacionGetPayload<{ select: typeof SELECT_BANDEJA_COMITE }>;
export type ApelacionDetalleComite = Prisma.ApelacionGetPayload<{ include: typeof INCLUDE_DETALLE_COMITE }>;

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
    crearConDocumento(data: Prisma.ApelacionUncheckedCreateInput) {
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

    /** Bandeja del comité (SPEC-110): orden estado asc + recientes primero; items + total. */
    findBandejaComite(
        where: Prisma.ApelacionWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<[ApelacionBandejaComiteRow[], number]> {
        return Promise.all([
            this.db.apelacion.findMany({
                where,
                orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
                skip: paginacion.skip,
                take: paginacion.take,
                select: SELECT_BANDEJA_COMITE,
            }),
            this.db.apelacion.count({ where }),
        ]);
    }

    /** Detalle para el comité: relaciones, documentos y accesos con usuario. */
    findDetalleComite(id: string): Promise<ApelacionDetalleComite | null> {
        return this.db.apelacion.findUnique({
            where: { id },
            include: INCLUDE_DETALLE_COMITE,
        });
    }

    /** Lectura mínima para tomar el caso (estado + asignación actual). */
    findEstadoParaTomar(id: string) {
        return this.db.apelacion.findUnique({
            where: { id },
            select: { id: true, estado: true, comiteId: true, numero: true },
        });
    }

    /** Toma el caso: RECIBIDA → EN_REVISION asignado al miembro que lo toma. */
    tomar(id: string, comiteId: string) {
        return this.db.apelacion.update({
            where: { id },
            data: { estado: "EN_REVISION", comiteId, asignadoEn: new Date() },
            select: { id: true, numero: true, estado: true, comiteId: true, asignadoEn: true },
        });
    }

    /** Apelación con sus documentos completos (descarga de evidencia). */
    findConDocumentos(id: string) {
        return this.db.apelacion.findUnique({
            where: { id },
            select: { id: true, numero: true, documentos: true },
        });
    }

    /** Lectura mínima para resolver (identificador + plataforma + asignación). */
    findParaResolver(id: string) {
        return this.db.apelacion.findUnique({
            where: { id },
            select: { id: true, numero: true, identificador: true, plataformaId: true, estado: true, comiteId: true },
        });
    }

    /** Actualización de resolución (dentro de la tx del servicio). */
    actualizar(id: string, data: Prisma.ApelacionUncheckedUpdateInput) {
        return this.db.apelacion.update({ where: { id }, data });
    }
}
