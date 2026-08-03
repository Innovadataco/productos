/**
 * SPEC-134 (E-1): repositorio de Estudiante — tenant obligatorio por construcción.
 * Toda firma exige `colegioId` y todo `where` lo incluye (incluso las lecturas por
 * curso: defensa en profundidad — hoy el curso ya viene verificado, el filtro es
 * idéntico en resultado). Escrituras por id = `updateMany({ id, colegioId })` con
 * count → 404. Acepta un cliente transaccional opcional (D2) — la carga masiva lo
 * usa en tx.
 *
 * SPEC-144 (D1): los acudientes (tabla hija AcudienteEstudiante) NUNCA se consultan
 * por id suelto: se crean/leen SIEMPRE a través del estudiante ya acotado por
 * colegioId (create anidado / include), máximo 2 por estudiante.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";
import type { EstadoActivo } from "./curso";

/** Datos de un acudiente para el alta anidada (D1: orden 1|2, máx 2 por Zod). */
export interface DatosAcudiente {
    orden: 1 | 2;
    nombre: string;
    relacion: string;
    telefono?: string | undefined;
    email?: string | undefined;
}

export class EstudianteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Estudiantes activos del curso, SIEMPRE acotados al colegio (GET estudiantes del curso). */
    listarPorCurso(colegioId: string, cursoId: string) {
        return this.db.estudiante.findMany({
            where: { cursoId, colegioId, estado: "activo" },
            orderBy: { nombre: "asc" },
        });
    }

    /**
     * SPEC-141 (N-1): estudiantes del curso paginados con sus identificadores activos
     * (vista de soporte ADMIN, solo lectura). Incluye estudiantes de cualquier estado
     * (soporte histórico); SIEMPRE acotado al colegio. Devuelve [items, total].
     */
    listarPorCursoPaginadosConIdentificadores(
        colegioId: string,
        cursoId: string,
        paginacion: { skip: number; take: number }
    ) {
        const where = { cursoId, colegioId } satisfies Prisma.EstudianteWhereInput;
        return Promise.all([
            this.db.estudiante.findMany({
                where,
                orderBy: { nombre: "asc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: {
                    identificadores: {
                        where: { estado: "activo" },
                        include: { plataforma: { select: { id: true, clave: true, nombre: true } } },
                        orderBy: { createdAt: "desc" },
                    },
                },
            }),
            this.db.estudiante.count({ where }),
        ]);
    }

    /** Total de estudiantes del colegio (totales generales de estadísticas). */
    contarPorColegio(colegioId: string): Promise<number> {
        return this.db.estudiante.count({ where: { colegioId } });
    }

    /** Conteo de estudiantes agrupado por curso (estadísticas por curso). */
    async contarPorCursoIds(colegioId: string, cursoIds: string[]): Promise<Map<string, number>> {
        if (cursoIds.length === 0) return new Map();
        const rows = await this.db.estudiante.groupBy({
            by: ["cursoId"],
            where: { cursoId: { in: cursoIds }, colegioId },
            _count: { cursoId: true },
        });
        return new Map(rows.map((r) => [r.cursoId, r._count.cursoId]));
    }

    /** Estudiante por id, SIEMPRE filtrado por tenant. Null si no existe o es ajeno. */
    obtenerPorId(colegioId: string, id: string) {
        return this.db.estudiante.findFirst({
            where: { id, colegioId },
        });
    }

    /** Estudiante activo con ese nombre + apellidos en el curso (duplicado de alta y carga masiva). */
    buscarPorNombreEnCurso(colegioId: string, cursoId: string, nombre: string, apellidos: string) {
        return this.db.estudiante.findFirst({
            where: { cursoId, colegioId, nombre, apellidos, estado: "activo" },
        });
    }

    /** Duplicado de nombre + apellidos en OTRO estudiante del mismo curso (edición). */
    buscarDuplicadoEnCurso(colegioId: string, cursoId: string, nombre: string, apellidos: string, excluirId: string) {
        return this.db.estudiante.findFirst({
            where: { id: { not: excluirId }, cursoId, colegioId, nombre, apellidos, estado: "activo" },
        });
    }

    /**
     * Crea el estudiante en el curso del colegio, con sus acudientes (máx 2) en UNA
     * escritura atómica (create anidado — D1/SPEC-137, candado §7.4). 404 si el
     * curso no es del colegio.
     */
    async crear(
        colegioId: string,
        datos: {
            cursoId: string;
            nombre: string;
            apellidos: string;
            documentoTipo?: string | undefined;
            documentoNumero?: string | undefined;
            acudientes?: DatosAcudiente[] | undefined;
        }
    ) {
        const curso = await this.db.curso.findFirst({
            where: { id: datos.cursoId, colegioId },
            select: { id: true },
        });
        if (!curso) {
            throw new AppError("Curso no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.estudiante.create({
            data: {
                cursoId: datos.cursoId,
                colegioId,
                nombre: datos.nombre,
                apellidos: datos.apellidos,
                documentoTipo: datos.documentoTipo ?? null,
                documentoNumero: datos.documentoNumero ?? null,
                estado: "activo",
                ...(datos.acudientes && datos.acudientes.length > 0
                    ? {
                        acudientes: {
                            create: datos.acudientes.map((a) => ({
                                orden: a.orden,
                                nombre: a.nombre,
                                relacion: a.relacion,
                                telefono: a.telefono ?? null,
                                email: a.email ?? null,
                            })),
                        },
                    }
                    : {}),
            },
            include: { acudientes: true },
        });
    }

    /** Actualiza nombre/apellidos del estudiante. 404 si el id no existe o es de OTRO colegio. */
    async actualizar(colegioId: string, id: string, datos: { nombre?: string; apellidos?: string }) {
        const { count } = await this.db.estudiante.updateMany({
            where: { id, colegioId },
            data: datos,
        });
        if (count === 0) {
            throw new AppError("Alumno no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.estudiante.findUniqueOrThrow({ where: { id } });
    }

    /** Cambia el estado del estudiante. 404 si el id no existe o es de OTRO colegio. */
    async cambiarEstado(colegioId: string, id: string, estado: EstadoActivo) {
        const { count } = await this.db.estudiante.updateMany({
            where: { id, colegioId },
            data: { estado },
        });
        if (count === 0) {
            throw new AppError("Alumno no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.estudiante.findUniqueOrThrow({ where: { id } });
    }
}
