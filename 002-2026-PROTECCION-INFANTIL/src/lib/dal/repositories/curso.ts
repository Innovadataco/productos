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
    grado: string | null | undefined;
    anioLectivo: string | null | undefined;
}

const SELECT_PARA_ESTADISTICAS = {
    id: true,
    nombre: true,
    grado: true,
    anioLectivo: true,
    // SPEC-143 (T002): titular disponible para las vistas del colegio (aditivo; los
    // consumidores existentes de CursoParaEstadisticasRow lo ignoran).
    profesorTitular: { select: { nombre: true, apellidos: true } },
} satisfies Prisma.CursoSelect;

const SELECT_CON_TITULAR = {
    id: true,
    nombre: true,
    // SPEC-147 (T003): el escritorio del curso necesita la ficha completa y el
    // ESTADO del titular (COND-2 de SPEC-145: titular inactivo se muestra marcado).
    // Aditivo: los consumidores previos (home, cursosMirada) ignoran los campos nuevos.
    grado: true,
    anioLectivo: true,
    estado: true,
    profesorTitularId: true,
    profesorTitular: { select: { nombre: true, apellidos: true, estado: true } },
} satisfies Prisma.CursoSelect;

export type CursoParaEstadisticasRow = Prisma.CursoGetPayload<{ select: typeof SELECT_PARA_ESTADISTICAS }>;
export type CursoConTitularRow = Prisma.CursoGetPayload<{ select: typeof SELECT_CON_TITULAR }>;

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

    /** SPEC-143: cursos ACTIVOS del colegio (KPI de la home — variante aditiva). */
    contarActivos(colegioId: string): Promise<number> {
        return this.db.curso.count({ where: { colegioId, estado: "activo" } });
    }

    /** SPEC-143: cursos del colegio por ids con su profesor titular ("cursos que merecen mirada"). */
    obtenerConTitularPorIds(colegioId: string, ids: string[]): Promise<CursoConTitularRow[]> {
        if (ids.length === 0) return Promise.resolve([]);
        return this.db.curso.findMany({
            where: { colegioId, id: { in: ids } },
            select: SELECT_CON_TITULAR,
        });
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
    crear(colegioId: string, datos: { nombre: string; grado?: string | null | undefined; anioLectivo?: string | null | undefined; profesorTitularId?: string | null | undefined }) {
        return this.db.curso.create({
            data: {
                colegioId,
                nombre: datos.nombre,
                grado: datos.grado ?? null,
                anioLectivo: datos.anioLectivo ?? null,
                estado: "activo",
                // SPEC-145 (D1=A): la ruta ya validó que el profesor es del mismo colegio.
                profesorTitularId: datos.profesorTitularId ?? null,
            },
        });
    }

    /** Actualiza datos del curso. 404 si el id no existe o es de OTRO colegio. */
    async actualizar(colegioId: string, id: string, datos: { nombre?: string | undefined; grado?: string | null | undefined; anioLectivo?: string | null | undefined; profesorTitularId?: string | null | undefined }) {
        const { count } = await this.db.curso.updateMany({
            where: { id, colegioId },
            // Campo ausente ≡ no tocarlo (undefined nunca llega a Prisma).
            // SPEC-145 (D1=A): profesorTitularId null desasigna explícitamente.
            data: {
                ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
                ...(datos.grado !== undefined ? { grado: datos.grado } : {}),
                ...(datos.anioLectivo !== undefined ? { anioLectivo: datos.anioLectivo } : {}),
                ...(datos.profesorTitularId !== undefined ? { profesorTitularId: datos.profesorTitularId } : {}),
            },
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
