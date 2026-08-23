/**
 * SPEC-235 (002-PI-135): repositorio del agregado GuiaAccionCategoria.
 * Frontera DAL (Q-3): todo acceso a esta entidad pasa por aquí.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { EstadoGuiaAccion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";

export interface CrearGuiaAccionInput {
    categoria: string;
    versionSecuencial: number;
    tituloEmocional: string;
    subtitulo?: string | null;
    categoriaBadgeTexto: string;
    pasosJson: Prisma.InputJsonValue;
    calloutTitulo?: string | null;
    calloutTexto?: string | null;
    botonesAccionJson: Prisma.InputJsonValue;
    piePagina?: string | null;
    estado: EstadoGuiaAccion;
    aprobadaPorComiteJson?: Prisma.InputJsonValue;
    creadaPorAdminId: string;
}

export interface EditarGuiaAccionInput {
    tituloEmocional?: string;
    subtitulo?: string | null;
    categoriaBadgeTexto?: string;
    pasosJson?: Prisma.InputJsonValue;
    calloutTitulo?: string | null;
    calloutTexto?: string | null;
    botonesAccionJson?: Prisma.InputJsonValue;
    piePagina?: string | null;
}

export interface ListarGuiasFiltros {
    estado?: EstadoGuiaAccion;
    categoria?: string;
    page: number;
    pageSize: number;
}

export class GuiaAccionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    async crear(input: CrearGuiaAccionInput) {
        return this.db.guiaAccionCategoria.create({ data: input });
    }

    async buscarPorId(id: string) {
        return this.db.guiaAccionCategoria.findUnique({ where: { id } });
    }

    async buscarActivaPorCategoria(categoria: string) {
        return this.db.guiaAccionCategoria.findFirst({
            where: { categoria, estado: EstadoGuiaAccion.ACTIVA },
        });
    }

    async buscarUltimaVersionPorCategoria(categoria: string) {
        return this.db.guiaAccionCategoria.findFirst({
            where: { categoria },
            orderBy: { versionSecuencial: "desc" },
        });
    }

    async listar(filtros: ListarGuiasFiltros) {
        const where: Prisma.GuiaAccionCategoriaWhereInput = {};
        if (filtros.estado) where.estado = filtros.estado;
        if (filtros.categoria) where.categoria = filtros.categoria;

        const skip = (filtros.page - 1) * filtros.pageSize;
        const [items, total] = await Promise.all([
            this.db.guiaAccionCategoria.findMany({
                where,
                orderBy: [{ categoria: "asc" }, { versionSecuencial: "desc" }],
                skip,
                take: filtros.pageSize,
                include: { creadaPor: { select: { id: true, email: true, nombre: true } } },
            }),
            this.db.guiaAccionCategoria.count({ where }),
        ]);

        return {
            items,
            pagination: {
                page: filtros.page,
                pageSize: filtros.pageSize,
                total,
                totalPages: Math.ceil(total / filtros.pageSize),
            },
        };
    }

    async listarPendientesDeAprobacion(paginacion: { page: number; pageSize: number }) {
        return this.listar({
            estado: EstadoGuiaAccion.PENDIENTE_APROBACION_COMITE,
            page: paginacion.page,
            pageSize: paginacion.pageSize,
        });
    }

    async editarContenido(id: string, input: EditarGuiaAccionInput) {
        return this.db.guiaAccionCategoria.update({
            where: { id },
            data: {
                ...input,
                // Los campos JSON deben reemplazarse completamente, no mergearse.
                ...(input.pasosJson !== undefined ? { pasosJson: input.pasosJson } : {}),
                ...(input.botonesAccionJson !== undefined ? { botonesAccionJson: input.botonesAccionJson } : {}),
            },
        });
    }

    async cambiarEstado(id: string, estado: EstadoGuiaAccion) {
        return this.db.guiaAccionCategoria.update({
            where: { id },
            data: { estado },
        });
    }

    async enviarAComite(id: string) {
        return this.cambiarEstado(id, EstadoGuiaAccion.PENDIENTE_APROBACION_COMITE);
    }

    async reemplazarActivaPorCategoria(categoria: string) {
        return this.db.guiaAccionCategoria.updateMany({
            where: { categoria, estado: EstadoGuiaAccion.ACTIVA },
            data: { estado: EstadoGuiaAccion.REEMPLAZADA, reemplazadaEn: new Date() },
        });
    }

    async publicar(id: string) {
        return this.db.guiaAccionCategoria.update({
            where: { id },
            data: { estado: EstadoGuiaAccion.ACTIVA, publicadaEn: new Date() },
        });
    }

    async rechazar(id: string) {
        return this.db.guiaAccionCategoria.update({
            where: { id },
            data: {
                estado: EstadoGuiaAccion.BORRADOR,
                aprobadaPorComiteJson: [],
            },
        });
    }

    async actualizarVotos(id: string, votos: Prisma.InputJsonValue) {
        return this.db.guiaAccionCategoria.update({
            where: { id },
            data: { aprobadaPorComiteJson: votos },
        });
    }

    /** Verifica que exista una guía en estado editable antes de operar. */
    async requiereEstado(id: string, estado: EstadoGuiaAccion) {
        const guia = await this.buscarPorId(id);
        if (!guia) {
            throw new AppError("Guía no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        if (guia.estado !== estado) {
            throw new AppError(
                `La guía no está en estado ${estado}`,
                ERROR_CODES.CONFLICT,
                409
            );
        }
        return guia;
    }
}
