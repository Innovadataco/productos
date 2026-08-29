/**
 * SPEC-162: repositorio de Materia — catálogo colegio-scoped.
 * Tenant obligatorio por construcción (SPEC-134 / DAL E-1).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";

export type EstadoMateria = "activo" | "inactivo";

function normalizarNombre(nombre: string): string {
    return nombre.trim().replace(/\s+/g, " ");
}

export class MateriaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Lista las materias activas del colegio ordenadas por nombre. */
    listarActivas(colegioId: string) {
        return this.db.materia.findMany({
            where: { colegioId, estado: "activo" },
            orderBy: { nombre: "asc" },
        });
    }

    /** Todas las materias del colegio (activas e inactivas). */
    listarTodas(colegioId: string) {
        return this.db.materia.findMany({
            where: { colegioId },
            orderBy: { nombre: "asc" },
        });
    }

    /** Materia por id, SIEMPRE filtrada por colegio. Null si no existe o es ajena. */
    obtenerPorId(colegioId: string, id: string) {
        return this.db.materia.findFirst({
            where: { id, colegioId },
        });
    }

    /** Busca una materia por nombre exacto (case-insensitive, espacios normalizados). */
    private async buscarPorNombre(colegioId: string, nombre: string) {
        const normalizado = normalizarNombre(nombre);
        return this.db.materia.findFirst({
            where: {
                colegioId,
                nombre: { equals: normalizado, mode: "insensitive" },
            },
        });
    }

    /** Crea una materia en el colegio. 409 si ya existe una con el mismo nombre. */
    async crear(colegioId: string, nombre: string) {
        const normalizado = normalizarNombre(nombre);
        if (normalizado.length === 0) {
            throw new AppError("El nombre de la materia no puede estar vacío", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const existente = await this.buscarPorNombre(colegioId, normalizado);
        if (existente) {
            throw new AppError("Ya existe una materia con ese nombre", ERROR_CODES.CONFLICT, 409);
        }

        return this.db.materia.create({
            data: {
                colegioId,
                nombre: normalizado,
                estado: "activo",
            },
        });
    }

    /** Actualiza el nombre de una materia. 404 si no existe o es ajena; 409 si genera duplicado. */
    async actualizar(colegioId: string, id: string, nombre: string) {
        const normalizado = normalizarNombre(nombre);
        if (normalizado.length === 0) {
            throw new AppError("El nombre de la materia no puede estar vacío", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const actual = await this.obtenerPorId(colegioId, id);
        if (!actual) {
            throw new AppError("Materia no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        if (normalizarNombre(actual.nombre).toLowerCase() !== normalizado.toLowerCase()) {
            const existente = await this.buscarPorNombre(colegioId, normalizado);
            if (existente && existente.id !== id) {
                throw new AppError("Ya existe una materia con ese nombre", ERROR_CODES.CONFLICT, 409);
            }
        }

        const { count } = await this.db.materia.updateMany({
            where: { id, colegioId },
            data: { nombre: normalizado },
        });

        if (count === 0) {
            throw new AppError("Materia no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        return this.db.materia.findUniqueOrThrow({ where: { id } });
    }

    /** Cambia el estado de una materia (soft delete / reactivación). */
    async cambiarEstado(colegioId: string, id: string, estado: EstadoMateria) {
        const { count } = await this.db.materia.updateMany({
            where: { id, colegioId },
            data: { estado },
        });

        if (count === 0) {
            throw new AppError("Materia no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        return this.db.materia.findUniqueOrThrow({ where: { id } });
    }
}
