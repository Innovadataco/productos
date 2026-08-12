/**
 * SPEC-162: repositorio de CursoMateria — vínculo Curso × Materia × Profesor.
 * Tenant obligatorio por construcción (SPEC-134 / DAL E-1).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";
import type { EstadoActivo } from "./curso";

const SELECT_CON_RELACIONES = {
    id: true,
    colegioId: true,
    cursoId: true,
    materiaId: true,
    profesorId: true,
    estado: true,
    creadoEn: true,
    actualizadoEn: true,
    materia: { select: { id: true, nombre: true, estado: true } },
    profesor: { select: { id: true, nombre: true, apellidos: true, estado: true } },
} satisfies Prisma.CursoMateriaSelect;

export type CursoMateriaConRelaciones = Prisma.CursoMateriaGetPayload<{ select: typeof SELECT_CON_RELACIONES }>;

export class CursoMateriaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Vínculos activos de un curso con materia y profesor. */
    listarPorCurso(colegioId: string, cursoId: string): Promise<CursoMateriaConRelaciones[]> {
        return this.db.cursoMateria.findMany({
            where: { colegioId, cursoId, estado: "activo" },
            select: SELECT_CON_RELACIONES,
            orderBy: { materia: { nombre: "asc" } },
        });
    }

    /** Vínculo por id, SIEMPRE filtrado por colegio. Null si no existe o es ajeno. */
    obtenerPorId(colegioId: string, id: string): Promise<CursoMateriaConRelaciones | null> {
        return this.db.cursoMateria.findFirst({
            where: { id, colegioId },
            select: SELECT_CON_RELACIONES,
        });
    }

    /**
     * Crea el vínculo Curso × Materia × Profesor.
     * Valida: curso propio, materia activa propia, profesor activo propio (si aplica),
     * y que no exista un vínculo activo duplicado (cursoId, materiaId).
     */
    async crear(
        colegioId: string,
        datos: { cursoId: string; materiaId: string; profesorId?: string | null | undefined }
    ) {
        const { cursoId, materiaId, profesorId } = datos;

        const curso = await this.db.curso.findFirst({ where: { id: cursoId, colegioId } });
        if (!curso) {
            throw new AppError("Curso no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const materia = await this.db.materia.findFirst({ where: { id: materiaId, colegioId } });
        if (!materia) {
            throw new AppError("Materia no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        if (materia.estado !== "activo") {
            throw new AppError("La materia debe estar activa", ERROR_CODES.CONFLICT, 409);
        }

        if (profesorId) {
            const profesor = await this.db.profesor.findFirst({ where: { id: profesorId, colegioId } });
            if (!profesor) {
                throw new AppError("Profesor no encontrado", ERROR_CODES.NOT_FOUND, 404);
            }
            if (profesor.estado !== "activo") {
                throw new AppError("El profesor debe estar activo", ERROR_CODES.CONFLICT, 409);
            }
        }

        const existente = await this.db.cursoMateria.findFirst({
            where: { cursoId, materiaId, colegioId, estado: "activo" },
        });
        if (existente) {
            throw new AppError("El curso ya tiene asignada esa materia", ERROR_CODES.CONFLICT, 409);
        }

        return this.db.cursoMateria.create({
            data: {
                colegioId,
                cursoId,
                materiaId,
                profesorId: profesorId ?? null,
                estado: "activo",
            },
            select: SELECT_CON_RELACIONES,
        });
    }

    /** Cambia el estado del vínculo (soft delete / reactivación). 404 si no existe o es ajeno. */
    async cambiarEstado(colegioId: string, id: string, estado: EstadoActivo) {
        const { count } = await this.db.cursoMateria.updateMany({
            where: { id, colegioId },
            data: { estado },
        });
        if (count === 0) {
            throw new AppError("Vínculo no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.cursoMateria.findUniqueOrThrow({ where: { id }, select: SELECT_CON_RELACIONES });
    }
}
