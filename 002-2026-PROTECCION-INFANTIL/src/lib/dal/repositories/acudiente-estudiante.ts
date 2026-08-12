/**
 * SPEC-163: repositorio de AcudienteEstudiante — gestión post-alta, baja lógica e
 * identificadores tipados. Tenant obligatorio por construcción (SPEC-134 / DAL E-1);
 * el acudiente se alcanza SIEMPRE vía el estudiante ya acotado por colegioId.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";
import { withUnitOfWork } from "../unit-of-work";

export type EstadoAcudiente = "activo" | "inactivo";

const SELECT_CON_RELACIONES = {
    id: true,
    estudianteId: true,
    orden: true,
    nombre: true,
    relacion: true,
    telefono: true,
    email: true,
    estado: true,
    createdAt: true,
    updatedAt: true,
    identificadores: {
        where: { estado: "activo" },
        select: {
            id: true,
            tipo: true,
            valor: true,
            plataformaId: true,
            plataforma: { select: { id: true, clave: true, nombre: true } },
            estado: true,
            createdAt: true,
            updatedAt: true,
        },
    },
} satisfies Prisma.AcudienteEstudianteSelect;

export type AcudienteConIdentificadores = Prisma.AcudienteEstudianteGetPayload<{
    select: typeof SELECT_CON_RELACIONES;
}>;

export interface DatosAcudiente {
    orden: 1 | 2;
    nombre: string;
    relacion: string;
    telefono?: string | null | undefined;
    email?: string | null | undefined;
}

export class AcudienteEstudianteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Acudientes activos del estudiante, SIEMPRE acotados al colegio, con identificadores activos. */
    listarActivosPorEstudiante(colegioId: string, estudianteId: string): Promise<AcudienteConIdentificadores[]> {
        return this.db.acudienteEstudiante.findMany({
            where: { estudianteId, estado: "activo", estudiante: { colegioId } },
            select: SELECT_CON_RELACIONES,
            orderBy: { orden: "asc" },
        });
    }

    /** Acudiente por id, SIEMPRE filtrado por colegio. Null si no existe o es ajeno. */
    obtenerPorId(colegioId: string, id: string): Promise<AcudienteConIdentificadores | null> {
        return this.db.acudienteEstudiante.findFirst({
            where: { id, estudiante: { colegioId } },
            select: SELECT_CON_RELACIONES,
        });
    }

    /** Total de acudientes activos de estudiantes activos del colegio. */
    contarActivosPorColegio(colegioId: string): Promise<number> {
        return this.db.acudienteEstudiante.count({
            where: { estado: "activo", estudiante: { colegioId, estado: "activo" } },
        });
    }

    /** Conteo de acudientes activos agrupado por curso (solo estudiantes activos). */
    async contarActivosPorCursoIds(colegioId: string, cursoIds: string[]): Promise<Map<string, number>> {
        if (cursoIds.length === 0) return new Map();
        const resultados: { cursoId: string; total: bigint }[] = await this.db.$queryRaw`
            SELECT a."cursoId" as "cursoId", COUNT(ae.id) as total
            FROM "AcudienteEstudiante" ae
            JOIN "Alumno" a ON a.id = ae."estudianteId"
            WHERE a."colegioId" = ${colegioId}
              AND a."cursoId" IN (${Prisma.join(cursoIds)})
              AND a.estado = 'activo'
              AND ae.estado = 'activo'
            GROUP BY a."cursoId"
        `;
        return new Map(resultados.map((r) => [r.cursoId, Number(r.total)]));
    }

    /** Total de acudientes activos de un estudiante, acotado al colegio. */
    contarActivosPorEstudiante(colegioId: string, estudianteId: string): Promise<number> {
        return this.db.acudienteEstudiante.count({
            where: { estudianteId, estado: "activo", estudiante: { colegioId } },
        });
    }

    /** Crea un acudiente activo si no excede el máximo de 2 ni el orden está ocupado. */
    async crear(colegioId: string, estudianteId: string, datos: DatosAcudiente): Promise<AcudienteConIdentificadores> {
        const estudiante = await this.db.estudiante.findFirst({
            where: { id: estudianteId, colegioId },
            select: { id: true },
        });
        if (!estudiante) {
            throw new AppError("Alumno no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const activos = await this.db.acudienteEstudiante.count({ where: { estudianteId, estado: "activo" } });
        if (activos >= 2) {
            throw new AppError("Máximo 2 acudientes activos por estudiante", ERROR_CODES.CONFLICT, 409);
        }

        const ordenOcupado = await this.db.acudienteEstudiante.findFirst({
            where: { estudianteId, orden: datos.orden, estado: "activo" },
        });
        if (ordenOcupado) {
            throw new AppError("Ya existe un acudiente activo con ese orden", ERROR_CODES.CONFLICT, 409);
        }

        return this.db.acudienteEstudiante.create({
            data: {
                estudianteId,
                orden: datos.orden,
                nombre: datos.nombre,
                relacion: datos.relacion,
                telefono: datos.telefono ?? null,
                email: datos.email ?? null,
                estado: "activo",
            },
            select: SELECT_CON_RELACIONES,
        });
    }

    /** Actualiza datos del acudiente. 404 si no existe o es de OTRO colegio. */
    async actualizar(
        colegioId: string,
        id: string,
        datos: Partial<Pick<DatosAcudiente, "nombre" | "relacion" | "telefono" | "email">>
    ): Promise<AcudienteConIdentificadores> {
        const actual = await this.obtenerPorId(colegioId, id);
        if (!actual) {
            throw new AppError("Acudiente no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const data: Prisma.AcudienteEstudianteUpdateManyMutationInput = {};
        if (datos.nombre !== undefined) data.nombre = datos.nombre;
        if (datos.relacion !== undefined) data.relacion = datos.relacion;
        if (datos.telefono !== undefined) data.telefono = datos.telefono;
        if (datos.email !== undefined) data.email = datos.email;

        const { count } = await this.db.acudienteEstudiante.updateMany({
            where: { id, estudiante: { colegioId } },
            data,
        });
        if (count === 0) {
            throw new AppError("Acudiente no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        return this.db.acudienteEstudiante.findUniqueOrThrow({
            where: { id },
            select: SELECT_CON_RELACIONES,
        });
    }

    /**
     * Cambia el estado de un acudiente. La inactivación apaga en cascada sus
     * IdentificadorAcudiente activos. La reactivación respeta el máximo de 2 y el
     * orden libre. 404 si no existe o es ajeno.
     */
    async cambiarEstado(colegioId: string, id: string, estado: EstadoAcudiente): Promise<AcudienteConIdentificadores> {
        const actual = await this.obtenerPorId(colegioId, id);
        if (!actual) {
            throw new AppError("Acudiente no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (actual.estado === estado) {
            throw new AppError(`El acudiente ya está ${estado}`, ERROR_CODES.CONFLICT, 409);
        }

        if (estado === "activo") {
            const activos = await this.contarActivosPorEstudiante(colegioId, actual.estudianteId);
            if (activos >= 2) {
                throw new AppError("Máximo 2 acudientes activos por estudiante", ERROR_CODES.CONFLICT, 409);
            }
            const ordenOcupado = await this.db.acudienteEstudiante.findFirst({
                where: { estudianteId: actual.estudianteId, orden: actual.orden, estado: "activo", id: { not: id } },
            });
            if (ordenOcupado) {
                throw new AppError("Ya existe un acudiente activo con ese orden", ERROR_CODES.CONFLICT, 409);
            }
        }

        const txActual = this.db === prisma ? undefined : (this.db as Prisma.TransactionClient);
        return withUnitOfWork(async (db) => {
            if (estado === "inactivo") {
                await db.identificadorAcudiente.updateMany({
                    where: { acudienteId: id, estado: "activo" },
                    data: { estado: "inactivo" },
                });
            }

            const { count } = await db.acudienteEstudiante.updateMany({
                where: { id, estudiante: { colegioId } },
                data: { estado },
            });
            if (count === 0) {
                throw new AppError("Acudiente no encontrado", ERROR_CODES.NOT_FOUND, 404);
            }

            return db.acudienteEstudiante.findUniqueOrThrow({
                where: { id },
                select: SELECT_CON_RELACIONES,
            });
        }, txActual);
    }
}
