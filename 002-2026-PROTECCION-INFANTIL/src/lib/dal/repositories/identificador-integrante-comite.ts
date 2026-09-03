/**
 * SPEC-380 (PR B · C4/D-100) — repositorio de `IdentificadorIntegranteComite`.
 *
 * Mismo patrón que `IdentificadorProfesor` — soft delete por estado, tenant
 * obligatorio por colegio, y el matching cross-tenant vive en el propio
 * `buscarActivosPorValor` (EXCEPCIÓN documentada: alimentar `notificarColegioSiCorresponde`
 * a través de TODOS los colegios).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { AppError, ERROR_CODES } from "../../errors";
import type { DbClient } from "../unit-of-work";
import type { EstadoActivo } from "./curso";

const INCLUDE_PLATAFORMA = {
    plataforma: { select: { id: true, clave: true, nombre: true } },
} satisfies Prisma.IdentificadorIntegranteComiteInclude;

export type IdentificadorIntegranteComiteConPlataforma = Prisma.IdentificadorIntegranteComiteGetPayload<{
    include: typeof INCLUDE_PLATAFORMA;
}>;

const INCLUDE_INTEGRANTE_COLEGIO = {
    integrante: {
        select: {
            nombres: true,
            apellidos: true,
            cargo: true,
            comite: { select: { comiteColegioId: true } },
        },
    },
} satisfies Prisma.IdentificadorIntegranteComiteInclude;

export type IdentificadorIntegranteComiteConColegio = Prisma.IdentificadorIntegranteComiteGetPayload<{
    include: typeof INCLUDE_INTEGRANTE_COLEGIO;
}>;

export interface DatosIdentificadorIntegranteComite {
    integranteId: string;
    tipo: string;
    valor: string;
    plataformaId: string | null;
}

export class IdentificadorIntegranteComiteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    listarPorIntegrante(colegioId: string, integranteId: string): Promise<IdentificadorIntegranteComiteConPlataforma[]> {
        return this.db.identificadorIntegranteComite.findMany({
            where: { integranteId, estado: "activo", colegioId },
            include: INCLUDE_PLATAFORMA,
            orderBy: { createdAt: "desc" },
        });
    }

    obtenerPorId(colegioId: string, id: string): Promise<IdentificadorIntegranteComiteConPlataforma | null> {
        return this.db.identificadorIntegranteComite.findFirst({
            where: { id, colegioId },
            include: INCLUDE_PLATAFORMA,
        });
    }

    buscarDuplicado(
        colegioId: string,
        datos: Pick<DatosIdentificadorIntegranteComite, "integranteId" | "tipo" | "valor" | "plataformaId">,
        excluirId?: string,
    ): Promise<IdentificadorIntegranteComiteConPlataforma | null> {
        return this.db.identificadorIntegranteComite.findFirst({
            where: {
                ...(excluirId ? { id: { not: excluirId } } : {}),
                integranteId: datos.integranteId,
                tipo: datos.tipo,
                valor: datos.valor,
                plataformaId: datos.plataformaId ?? null,
                colegioId,
            },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /**
     * Crea el identificador bajo un integrante del colegio. El helper resuelve
     * el `colegioId` desde la cuenta del comité (comité colegio-scoped) para no
     * confiar en el que llegó por el request.
     */
    async crear(
        colegioId: string,
        datos: DatosIdentificadorIntegranteComite,
    ): Promise<IdentificadorIntegranteComiteConPlataforma> {
        const integrante = await this.db.integranteComite.findFirst({
            where: {
                id: datos.integranteId,
                comite: { comiteColegioId: colegioId },
            },
            select: { id: true, estado: true },
        });
        if (!integrante) {
            throw new AppError("Integrante no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (integrante.estado !== "ACTIVO") {
            throw new AppError("No se puede editar un integrante inactivo", ERROR_CODES.CONFLICT, 409);
        }

        return this.db.identificadorIntegranteComite.create({
            data: {
                integranteId: datos.integranteId,
                colegioId,
                tipo: datos.tipo,
                valor: datos.valor,
                plataformaId: datos.plataformaId ?? null,
                estado: "activo",
            },
            include: INCLUDE_PLATAFORMA,
        });
    }

    async cambiarEstado(
        colegioId: string,
        id: string,
        estado: EstadoActivo,
    ): Promise<IdentificadorIntegranteComiteConPlataforma> {
        const { count } = await this.db.identificadorIntegranteComite.updateMany({
            where: { id, colegioId },
            data: { estado },
        });
        if (count === 0) {
            throw new AppError("Identificador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.identificadorIntegranteComite.findUniqueOrThrow({
            where: { id },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /**
     * EXCEPCIÓN cross-tenant (ver cabecera): identificadores activos con ese valor
     * en TODOS los colegios — alimenta `notificarColegioSiCorresponde`.
     */
    buscarActivosPorValor(valor: string): Promise<IdentificadorIntegranteComiteConColegio[]> {
        return this.db.identificadorIntegranteComite.findMany({
            where: { estado: "activo", valor: { equals: valor, mode: "insensitive" } },
            include: INCLUDE_INTEGRANTE_COLEGIO,
        });
    }
}
