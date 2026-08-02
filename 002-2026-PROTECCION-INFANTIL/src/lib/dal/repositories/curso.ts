/**
 * SPEC-134 (E-1): repositorio de Curso — tenant obligatorio por construcción.
 * Toda firma exige `colegioId` y todo `where` lo incluye. Las escrituras por id
 * van como `updateMany({ where: { id, colegioId } })` con count verificado:
 * 0 filas → AppError 404 (nunca un `update({ where: { id } })` desnudo).
 * Acepta un cliente transaccional opcional (D2) — la carga masiva lo usa en tx.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";

export type EstadoActivo = "activo" | "inactivo";

export interface DatosCurso {
    nombre: string;
    grado: string | null;
    anioLectivo: string | null;
}

const SELECT_PARA_ESTADISTICAS = {
    id: true,
    nombre: true,
    grado: true,
    anioLectivo: true,
} satisfies Prisma.CursoSelect;

export type CursoParaEstadisticasRow = Prisma.CursoGetPayload<{ select: typeof SELECT_PARA_ESTADISTICAS }>;

export class CursoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Cursos activos del colegio, ordenados por nombre (GET /api/colegio/cursos). */
    listarActivos(colegioId: string) {
        return this.db.curso.findMany({
            where: { colegioId, estado: "activo" },
            orderBy: { nombre: "asc" },
        });
    }

    /** Cursos (todos) con el mínimo para las estadísticas del colegio. */
    listarParaEstadisticas(colegioId: string): Promise<CursoParaEstadisticasRow[]> {
        return this.db.curso.findMany({
            where: { colegioId },
            select: SELECT_PARA_ESTADISTICAS,
            orderBy: [{ nombre: "asc" }, { grado: "asc" }],
        });
    }

    /** Total de cursos del colegio (totales generales de estadísticas). */
    contarPorColegio(colegioId: string): Promise<number> {
        return this.db.curso.count({ where: { colegioId } });
    }

    /** Curso por id, SIEMPRE filtrado por tenant. Null si no existe o es ajeno. */
    obtenerPorId(colegioId: string, id: string) {
        return this.db.curso.findFirst({
            where: { id, colegioId },
        });
    }

    /**
     * Curso del colegio con esos datos exactos (duplicado de alta y upsert de la
     * carga masiva). El grado/año ausente se busca como null (misma semántica actual).
     */
    buscarPorDatos(colegioId: string, datos: DatosCurso) {
        return this.db.curso.findFirst({
            where: {
                colegioId,
                nombre: datos.nombre,
                grado: datos.grado ?? null,
                anioLectivo: datos.anioLectivo ?? null,
            },
        });
    }

    /** Duplicado de datos en OTRO curso del mismo colegio (edición). */
    buscarDuplicado(colegioId: string, datos: DatosCurso, excluirId: string) {
        return this.db.curso.findFirst({
            where: {
                id: { not: excluirId },
                colegioId,
                nombre: datos.nombre,
                grado: datos.grado ?? null,
                anioLectivo: datos.anioLectivo ?? null,
            },
        });
    }

    /** Crea el curso del colegio (alta manual y carga masiva, ambas con estado activo). */
    crear(colegioId: string, datos: { nombre: string; grado?: string | null; anioLectivo?: string | null }) {
        return this.db.curso.create({
            data: {
                colegioId,
                nombre: datos.nombre,
                grado: datos.grado ?? null,
                anioLectivo: datos.anioLectivo ?? null,
                estado: "activo",
            },
        });
    }

    /** Actualiza datos del curso. 404 si el id no existe o es de OTRO colegio. */
    async actualizar(colegioId: string, id: string, datos: { nombre?: string; grado?: string | null; anioLectivo?: string | null }) {
        const { count } = await this.db.curso.updateMany({
            where: { id, colegioId },
            data: datos,
        });
        if (count === 0) {
            throw new AppError("Curso no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.curso.findUniqueOrThrow({ where: { id } });
    }

    /** Cambia el estado del curso. 404 si el id no existe o es de OTRO colegio. */
    async cambiarEstado(colegioId: string, id: string, estado: EstadoActivo) {
        const { count } = await this.db.curso.updateMany({
            where: { id, colegioId },
            data: { estado },
        });
        if (count === 0) {
            throw new AppError("Curso no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.curso.findUniqueOrThrow({ where: { id } });
    }
}
