/**
 * SPEC-134 (E-1): repositorio de IdentificadorEstudiante — tenant obligatorio por
 * construcción. El modelo NO tiene columna colegioId: el tenant viaja SIEMPRE por
 * la relación (`estudiante: { colegioId }`) en lecturas y escrituras por id. Las
 * escrituras por id van como `updateMany({ where: { id, estudiante: { colegioId } } })`
 * con count → 404. Acepta un cliente transaccional opcional (D2) — la carga masiva
 * lo usa en tx.
 *
 * EXCEPCIÓN DOCUMENTADA (cross-tenant a propósito): `buscarActivosPorValor` recorre
 * TODOS los colegios — es la búsqueda que alimenta las alertas: un reporte sobre un
 * identificador debe avisar a CADA colegio que lo registró (notificarColegioSiCorresponde).
 *
 * SPEC-144: la tabla física sigue siendo "IdentificadorAlumno" y la FK física
 * "alumnoId" (@@map/@map en el schema) — el SQL crudo de abajo usa los nombres
 * FÍSICOS a propósito.
 */
import { Prisma } from "@prisma/client";
import type { EtiquetaRelacionEstudiante } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";
import type { EstadoActivo } from "./curso";

const INCLUDE_PLATAFORMA = {
    plataforma: { select: { id: true, clave: true, nombre: true } },
} satisfies Prisma.IdentificadorEstudianteInclude;

export type IdentificadorConPlataforma = Prisma.IdentificadorEstudianteGetPayload<{ include: typeof INCLUDE_PLATAFORMA }>;

export interface DatosIdentificador {
    estudianteId: string;
    tipo: string;
    valor: string;
    plataformaId: string | null;
    etiquetaRelacion: EtiquetaRelacionEstudiante;
}

export class IdentificadorEstudianteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Identificadores activos del estudiante, SIEMPRE acotados al colegio. */
    listarPorEstudiante(colegioId: string, estudianteId: string): Promise<IdentificadorConPlataforma[]> {
        return this.db.identificadorEstudiante.findMany({
            where: { estudianteId, estado: "activo", estudiante: { colegioId } },
            include: INCLUDE_PLATAFORMA,
            orderBy: { createdAt: "desc" },
        });
    }

    /** Total de identificadores del colegio (totales generales de estadísticas). */
    contarPorColegio(colegioId: string): Promise<number> {
        return this.db.identificadorEstudiante.count({
            where: { estudiante: { colegioId } },
        });
    }

    /** Conteo de identificadores agrupado por curso (join con Estudiante, tenant en ambos lados). */
    async contarPorCursoIds(colegioId: string, cursoIds: string[]): Promise<Map<string, number>> {
        if (cursoIds.length === 0) return new Map();
        // Nombres FÍSICOS de tabla/columna (@@map/@map): no cambian con el rename.
        const resultados: { cursoId: string; total: bigint }[] = await this.db.$queryRaw`
            SELECT a."cursoId" as "cursoId", COUNT(*) as total
            FROM "IdentificadorAlumno" i
            JOIN "Alumno" a ON a.id = i."alumnoId"
            WHERE a."colegioId" = ${colegioId}
              AND a."cursoId" IN (${Prisma.join(cursoIds)})
            GROUP BY a."cursoId"
        `;
        return new Map(resultados.map((r) => [r.cursoId, Number(r.total)]));
    }

    /** Identificador por id, SIEMPRE filtrado por tenant. Null si no existe o es ajeno. */
    obtenerPorId(colegioId: string, id: string) {
        return this.db.identificadorEstudiante.findFirst({
            where: { id, estudiante: { colegioId } },
        });
    }

    /** Duplicado (tipo+valor+plataforma) en el mismo estudiante; `excluirId` para edición. */
    buscarDuplicado(colegioId: string, datos: Pick<DatosIdentificador, "estudianteId" | "tipo" | "valor" | "plataformaId">, excluirId?: string) {
        return this.db.identificadorEstudiante.findFirst({
            where: {
                ...(excluirId ? { id: { not: excluirId } } : {}),
                estudianteId: datos.estudianteId,
                tipo: datos.tipo,
                valor: datos.valor,
                plataformaId: datos.plataformaId ?? null,
                estudiante: { colegioId },
            },
        });
    }

    /**
     * Crea el identificador bajo un estudiante del colegio. La guarda de padre evita
     * por construcción colgar PII de un estudiante de OTRO colegio (404 en ese caso).
     */
    async crear(colegioId: string, datos: DatosIdentificador): Promise<IdentificadorConPlataforma> {
        const estudiante = await this.db.estudiante.findFirst({
            where: { id: datos.estudianteId, colegioId },
            select: { id: true },
        });
        if (!estudiante) {
            throw new AppError("Alumno no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.identificadorEstudiante.create({
            data: {
                estudianteId: datos.estudianteId,
                tipo: datos.tipo,
                valor: datos.valor,
                plataformaId: datos.plataformaId ?? null,
                etiquetaRelacion: datos.etiquetaRelacion,
                estado: "activo",
            },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /** Actualiza datos del identificador. 404 si el id no existe o es de OTRO colegio. */
    async actualizar(colegioId: string, id: string, datos: Partial<Pick<DatosIdentificador, "tipo" | "valor" | "plataformaId" | "etiquetaRelacion">>) {
        const { count } = await this.db.identificadorEstudiante.updateMany({
            where: { id, estudiante: { colegioId } },
            data: datos,
        });
        if (count === 0) {
            throw new AppError("Identificador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.identificadorEstudiante.findUniqueOrThrow({
            where: { id },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /** Cambia el estado del identificador. 404 si el id no existe o es de OTRO colegio. */
    async cambiarEstado(colegioId: string, id: string, estado: EstadoActivo) {
        const { count } = await this.db.identificadorEstudiante.updateMany({
            where: { id, estudiante: { colegioId } },
            data: { estado },
        });
        if (count === 0) {
            throw new AppError("Identificador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.identificadorEstudiante.findUniqueOrThrow({
            where: { id },
            include: INCLUDE_PLATAFORMA,
        });
    }

    /** Reactiva y re-etiqueta un identificador existente (upsert de la carga masiva). */
    async reactivar(colegioId: string, id: string, etiquetaRelacion: EtiquetaRelacionEstudiante) {
        const { count } = await this.db.identificadorEstudiante.updateMany({
            where: { id, estudiante: { colegioId } },
            data: { estado: "activo", etiquetaRelacion },
        });
        if (count === 0) {
            throw new AppError("Identificador no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
    }

    /**
     * EXCEPCIÓN cross-tenant (ver cabecera): identificadores activos con ese valor
     * en TODOS los colegios, con el colegio de cada estudiante para alertar a cada uno.
     */
    buscarActivosPorValor(valor: string) {
        return this.db.identificadorEstudiante.findMany({
            where: { estado: "activo", valor: { equals: valor, mode: "insensitive" } },
            include: { estudiante: { select: { colegioId: true } } },
        });
    }
}
