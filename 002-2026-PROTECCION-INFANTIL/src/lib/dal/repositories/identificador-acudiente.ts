/**
 * SPEC-163: repositorio de IdentificadorAcudiente — identificadores tipados de un
 * acudiente para matching de alertas (Fase C). Tenant obligatorio por construcción
 * (SPEC-134 / DAL E-1); la tabla lleva colegioId denormalizado para validaciones
 * y queries rápidas.
 *
 * EXCEPCIÓN DOCUMENTADA (cross-tenant a propósito): `buscarActivosPorValor` recorre
 * TODOS los colegios — es la búsqueda que alimentará las alertas de la Fase C.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";
import type { EstadoActivo } from "./curso";

const INCLUDE_PLATAFORMA = {
    plataforma: { select: { id: true, clave: true, nombre: true } },
} satisfies Prisma.IdentificadorAcudienteInclude;

export type IdentificadorAcudienteConPlataforma = Prisma.IdentificadorAcudienteGetPayload<{
    include: typeof INCLUDE_PLATAFORMA;
}>;

const INCLUDE_ACUDIENTE_CON_COLEGIO = {
    acudiente: { select: { estudiante: { select: { colegioId: true } } } },
} satisfies Prisma.IdentificadorAcudienteInclude;

export type IdentificadorAcudienteConColegio = Prisma.IdentificadorAcudienteGetPayload<{
    include: typeof INCLUDE_ACUDIENTE_CON_COLEGIO;
}>;

export interface DatosIdentificadorAcudiente {
    acudienteId: string;
    tipo: string;
    valor: string;
    plataformaId: string | null;
}

export class IdentificadorAcudienteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Identificadores activos del acudiente, SIEMPRE acotados al colegio. */
    listarPorAcudiente(colegioId: string, acudienteId: string): Promise<IdentificadorAcudienteConPlataforma[]> {
        return this.db.identificadorAcudiente.findMany({
            where: { acudienteId, estado: "activo", colegioId },
            include: INCLUDE_PLATAFORMA,
            orderBy: { createdAt: "desc" },
        });
    }

    /** Identificador por id, SIEMPRE filtrado por tenant. Null si no existe o es ajeno. */
    obtenerPorId(colegioId: string, id: string): Promise<IdentificadorAcudienteConPlataforma | null> {
        return this.db.identificadorAcudiente.findFirst({
            where: { id, colegioId },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /** Duplicado (tipo+valor+plataforma) en el mismo acudiente; `excluirId` para edición. */
    buscarDuplicado(
        colegioId: string,
        datos: Pick<DatosIdentificadorAcudiente, "acudienteId" | "tipo" | "valor" | "plataformaId">,
        excluirId?: string
    ): Promise<IdentificadorAcudienteConPlataforma | null> {
        return this.db.identificadorAcudiente.findFirst({
            where: {
                ...(excluirId ? { id: { not: excluirId } } : {}),
                acudienteId: datos.acudienteId,
                tipo: datos.tipo,
                valor: datos.valor,
                plataformaId: datos.plataformaId ?? null,
                colegioId,
            },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /**
     * Crea el identificador bajo un acudiente del colegio. La guarda de padre evita
     * por construcción colgar PII de un acudiente de OTRO colegio (404 en ese caso).
     */
    async crear(colegioId: string, datos: DatosIdentificadorAcudiente): Promise<IdentificadorAcudienteConPlataforma> {
        const acudiente = await this.db.acudienteEstudiante.findFirst({
            where: { id: datos.acudienteId, estudiante: { colegioId } },
            select: { id: true },
        });
        if (!acudiente) {
            throw new AppError("Acudiente no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        return this.db.identificadorAcudiente.create({
            data: {
                acudienteId: datos.acudienteId,
                colegioId,
                tipo: datos.tipo,
                valor: datos.valor,
                plataformaId: datos.plataformaId ?? null,
                estado: "activo",
            },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /** Actualiza datos del identificador. 404 si el id no existe o es de OTRO colegio. */
    async actualizar(
        colegioId: string,
        id: string,
        datos: Partial<Pick<DatosIdentificadorAcudiente, "tipo" | "valor" | "plataformaId">>
    ): Promise<IdentificadorAcudienteConPlataforma> {
        const { count } = await this.db.identificadorAcudiente.updateMany({
            where: { id, colegioId },
            data: datos,
        });
        if (count === 0) {
            throw new AppError("Identificador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.identificadorAcudiente.findUniqueOrThrow({
            where: { id },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /** Cambia el estado del identificador. 404 si el id no existe o es de OTRO colegio. */
    async cambiarEstado(colegioId: string, id: string, estado: EstadoActivo): Promise<IdentificadorAcudienteConPlataforma> {
        const { count } = await this.db.identificadorAcudiente.updateMany({
            where: { id, colegioId },
            data: { estado },
        });
        if (count === 0) {
            throw new AppError("Identificador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.identificadorAcudiente.findUniqueOrThrow({
            where: { id },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /**
     * EXCEPCIÓN cross-tenant (ver cabecera): identificadores activos con ese valor
     * en TODOS los colegios, con el colegio de cada acudiente para alertar a cada uno.
     */
    buscarActivosPorValor(valor: string): Promise<IdentificadorAcudienteConColegio[]> {
        return this.db.identificadorAcudiente.findMany({
            where: { estado: "activo", valor: { equals: valor, mode: "insensitive" } },
            include: INCLUDE_ACUDIENTE_CON_COLEGIO,
        });
    }
}
