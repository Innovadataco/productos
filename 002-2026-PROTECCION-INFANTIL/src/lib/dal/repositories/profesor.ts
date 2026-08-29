/**
 * SPEC-145 (E-1): repositorio de Profesor — tenant obligatorio por construcción.
 * Toda firma exige `colegioId` y todo `where` lo incluye. Las escrituras por id
 * van como `updateMany({ where: { id, colegioId } })` con count verificado:
 * 0 filas → AppError 404 (nunca un `update({ where: { id } })` desnudo).
 * Baja = soft delete (estado "inactivo") — NUNCA borrado físico (brief §7.2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";
import type { EstadoActivo } from "./curso";

/** Filtro de listado: activos por default; "todos" incluye inactivos. */
export type FiltroEstadoProfesor = EstadoActivo | "todos";

export class ProfesorRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Profesores del colegio paginados, SIEMPRE acotados al tenant. Devuelve [items, total]. */
    listarPaginados(
        colegioId: string,
        filtro: { estado: FiltroEstadoProfesor; skip: number; take: number }
    ) {
        const where = {
            colegioId,
            ...(filtro.estado === "todos" ? {} : { estado: filtro.estado }),
        } satisfies Prisma.ProfesorWhereInput;
        return Promise.all([
            this.db.profesor.findMany({
                where,
                orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
                skip: filtro.skip,
                take: filtro.take,
            }),
            this.db.profesor.count({ where }),
        ]);
    }

    /** Profesor por id, SIEMPRE filtrado por tenant. Null si no existe o es ajeno. */
    obtenerPorId(colegioId: string, id: string) {
        return this.db.profesor.findFirst({
            where: { id, colegioId },
        });
    }

    /** SPEC-143: profesores del colegio por estado (KPI de la home: "activo"). */
    contar(colegioId: string, estado: EstadoActivo = "activo"): Promise<number> {
        return this.db.profesor.count({ where: { colegioId, estado } });
    }

    /** Profesor activo con ese nombre + apellidos en el colegio (duplicado de alta → 409). */
    buscarPorNombreApellidosEnColegio(colegioId: string, nombre: string, apellidos: string) {
        return this.db.profesor.findFirst({
            where: { colegioId, nombre, apellidos, estado: "activo" },
        });
    }

    /** Crea el profesor del colegio (alta manual, estado activo). */
    crear(
        colegioId: string,
        datos: {
            nombre: string;
            apellidos: string;
            email?: string | undefined;
            telefono?: string | undefined;
        }
    ) {
        return this.db.profesor.create({
            data: {
                colegioId,
                nombre: datos.nombre,
                apellidos: datos.apellidos,
                email: datos.email ?? null,
                telefono: datos.telefono ?? null,
                estado: "activo",
            },
        });
    }

    /** Actualiza datos del profesor. 404 si el id no existe o es de OTRO colegio. */
    async actualizar(
        colegioId: string,
        id: string,
        datos: {
            nombre?: string | undefined;
            apellidos?: string | undefined;
            email?: string | null | undefined;
            telefono?: string | null | undefined;
        }
    ) {
        const { count } = await this.db.profesor.updateMany({
            where: { id, colegioId },
            // Campo ausente ≡ no tocarlo (undefined nunca llega a Prisma).
            data: {
                ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
                ...(datos.apellidos !== undefined ? { apellidos: datos.apellidos } : {}),
                ...(datos.email !== undefined ? { email: datos.email } : {}),
                ...(datos.telefono !== undefined ? { telefono: datos.telefono } : {}),
            },
        });
        if (count === 0) {
            throw new AppError("Profesor no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.profesor.findUniqueOrThrow({ where: { id } });
    }

    /** Cambia el estado del profesor (baja suave). 404 si el id no existe o es de OTRO colegio. */
    async cambiarEstado(colegioId: string, id: string, estado: EstadoActivo) {
        const { count } = await this.db.profesor.updateMany({
            where: { id, colegioId },
            data: { estado },
        });
        if (count === 0) {
            throw new AppError("Profesor no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.profesor.findUniqueOrThrow({ where: { id } });
    }
}
