/**
 * SPEC-164: repositorio de IdentificadorProfesor — identificadores tipados de un
 * profesor para matching de alertas (Fase C). Tenant obligatorio por construcción
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
} satisfies Prisma.IdentificadorProfesorInclude;

export type IdentificadorProfesorConPlataforma = Prisma.IdentificadorProfesorGetPayload<{
    include: typeof INCLUDE_PLATAFORMA;
}>;

const INCLUDE_PROFESOR_CON_COLEGIO = {
    profesor: { select: { colegioId: true } },
} satisfies Prisma.IdentificadorProfesorInclude;

export type IdentificadorProfesorConColegio = Prisma.IdentificadorProfesorGetPayload<{
    include: typeof INCLUDE_PROFESOR_CON_COLEGIO;
}>;

export interface DatosIdentificadorProfesor {
    profesorId: string;
    tipo: string;
    valor: string;
    plataformaId: string | null;
}

export class IdentificadorProfesorRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Identificadores activos del profesor, SIEMPRE acotados al colegio. */
    listarPorProfesor(colegioId: string, profesorId: string): Promise<IdentificadorProfesorConPlataforma[]> {
        return this.db.identificadorProfesor.findMany({
            where: { profesorId, estado: "activo", colegioId },
            include: INCLUDE_PLATAFORMA,
            orderBy: { createdAt: "desc" },
        });
    }

    /** Identificador por id, SIEMPRE filtrado por tenant. Null si no existe o es ajeno. */
    obtenerPorId(colegioId: string, id: string): Promise<IdentificadorProfesorConPlataforma | null> {
        return this.db.identificadorProfesor.findFirst({
            where: { id, colegioId },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /** Duplicado (tipo+valor+plataforma) en el mismo profesor; `excluirId` para edición. */
    buscarDuplicado(
        colegioId: string,
        datos: Pick<DatosIdentificadorProfesor, "profesorId" | "tipo" | "valor" | "plataformaId">,
        excluirId?: string
    ): Promise<IdentificadorProfesorConPlataforma | null> {
        return this.db.identificadorProfesor.findFirst({
            where: {
                ...(excluirId ? { id: { not: excluirId } } : {}),
                profesorId: datos.profesorId,
                tipo: datos.tipo,
                valor: datos.valor,
                plataformaId: datos.plataformaId ?? null,
                colegioId,
            },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /**
     * Crea el identificador bajo un profesor del colegio. La guarda de padre evita
     * por construcción colgar PII de un profesor de OTRO colegio (404 en ese caso).
     */
    async crear(colegioId: string, datos: DatosIdentificadorProfesor): Promise<IdentificadorProfesorConPlataforma> {
        const profesor = await this.db.profesor.findFirst({
            where: { id: datos.profesorId, colegioId },
            select: { id: true, estado: true },
        });
        if (!profesor) {
            throw new AppError("Profesor no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (profesor.estado !== "activo") {
            throw new AppError("No se puede editar un profesor inactivo", ERROR_CODES.CONFLICT, 409);
        }

        return this.db.identificadorProfesor.create({
            data: {
                profesorId: datos.profesorId,
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
        datos: Partial<Pick<DatosIdentificadorProfesor, "tipo" | "valor" | "plataformaId">>
    ): Promise<IdentificadorProfesorConPlataforma> {
        const { count } = await this.db.identificadorProfesor.updateMany({
            where: { id, colegioId },
            data: datos,
        });
        if (count === 0) {
            throw new AppError("Identificador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.identificadorProfesor.findUniqueOrThrow({
            where: { id },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /** Cambia el estado del identificador. 404 si el id no existe o es de OTRO colegio. */
    async cambiarEstado(colegioId: string, id: string, estado: EstadoActivo): Promise<IdentificadorProfesorConPlataforma> {
        const { count } = await this.db.identificadorProfesor.updateMany({
            where: { id, colegioId },
            data: { estado },
        });
        if (count === 0) {
            throw new AppError("Identificador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.identificadorProfesor.findUniqueOrThrow({
            where: { id },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /**
     * EXCEPCIÓN cross-tenant (ver cabecera): identificadores activos con ese valor
     * en TODOS los colegios, con el colegio de cada profesor para alertar a cada uno.
     */
    buscarActivosPorValor(valor: string): Promise<IdentificadorProfesorConColegio[]> {
        return this.db.identificadorProfesor.findMany({
            where: { estado: "activo", valor: { equals: valor, mode: "insensitive" } },
            include: INCLUDE_PROFESOR_CON_COLEGIO,
        });
    }
}
