/**
 * SPEC-134 (E-1): repositorio de Alumno — tenant obligatorio por construcción.
 * Toda firma exige `colegioId` y todo `where` lo incluye (incluso las lecturas por
 * curso: defensa en profundidad — hoy el curso ya viene verificado, el filtro es
 * idéntico en resultado). Escrituras por id = `updateMany({ id, colegioId })` con
 * count → 404. Acepta un cliente transaccional opcional (D2) — la carga masiva lo
 * usa en tx.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";
import type { EstadoActivo } from "./curso";

export class AlumnoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Alumnos activos del curso, SIEMPRE acotados al colegio (GET alumnos del curso). */
    listarPorCurso(colegioId: string, cursoId: string) {
        return this.db.alumno.findMany({
            where: { cursoId, colegioId, estado: "activo" },
            orderBy: { nombre: "asc" },
        });
    }

    /** Total de alumnos del colegio (totales generales de estadísticas). */
    contarPorColegio(colegioId: string): Promise<number> {
        return this.db.alumno.count({ where: { colegioId } });
    }

    /** Conteo de alumnos agrupado por curso (estadísticas por curso). */
    async contarPorCursoIds(colegioId: string, cursoIds: string[]): Promise<Map<string, number>> {
        if (cursoIds.length === 0) return new Map();
        const rows = await this.db.alumno.groupBy({
            by: ["cursoId"],
            where: { cursoId: { in: cursoIds }, colegioId },
            _count: { cursoId: true },
        });
        return new Map(rows.map((r) => [r.cursoId, r._count.cursoId]));
    }

    /** Alumno por id, SIEMPRE filtrado por tenant. Null si no existe o es ajeno. */
    obtenerPorId(colegioId: string, id: string) {
        return this.db.alumno.findFirst({
            where: { id, colegioId },
        });
    }

    /** Alumno activo con ese nombre en el curso (duplicado de alta y carga masiva). */
    buscarPorNombreEnCurso(colegioId: string, cursoId: string, nombre: string) {
        return this.db.alumno.findFirst({
            where: { cursoId, colegioId, nombre, estado: "activo" },
        });
    }

    /** Duplicado de nombre en OTRO alumno del mismo curso (edición). */
    buscarDuplicadoEnCurso(colegioId: string, cursoId: string, nombre: string, excluirId: string) {
        return this.db.alumno.findFirst({
            where: { id: { not: excluirId }, cursoId, colegioId, nombre, estado: "activo" },
        });
    }

    /** Crea el alumno en el curso del colegio. 404 si el curso no es del colegio. */
    async crear(colegioId: string, datos: { cursoId: string; nombre: string }) {
        const curso = await this.db.curso.findFirst({
            where: { id: datos.cursoId, colegioId },
            select: { id: true },
        });
        if (!curso) {
            throw new AppError("Curso no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.alumno.create({
            data: {
                cursoId: datos.cursoId,
                colegioId,
                nombre: datos.nombre,
                estado: "activo",
            },
        });
    }

    /** Actualiza el nombre del alumno. 404 si el id no existe o es de OTRO colegio. */
    async actualizar(colegioId: string, id: string, datos: { nombre?: string }) {
        const { count } = await this.db.alumno.updateMany({
            where: { id, colegioId },
            data: datos,
        });
        if (count === 0) {
            throw new AppError("Alumno no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.alumno.findUniqueOrThrow({ where: { id } });
    }

    /** Cambia el estado del alumno. 404 si el id no existe o es de OTRO colegio. */
    async cambiarEstado(colegioId: string, id: string, estado: EstadoActivo) {
        const { count } = await this.db.alumno.updateMany({
            where: { id, colegioId },
            data: { estado },
        });
        if (count === 0) {
            throw new AppError("Alumno no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.alumno.findUniqueOrThrow({ where: { id } });
    }
}
