/**
 * SPEC-150 (FR-001/FR-002): repositorio de EstudianteObservacion — la marca de
 * observación especial del estudiante. Tenant obligatorio por construcción
 * (toda firma exige `colegioId` y todo `where` lo incluye).
 *
 * - Marcar es IDEMPOTENTE en servicio (doble clic / dos requests): se busca la
 *   activa antes de crear; si ya hay una, se devuelve SIN duplicar (`creada=false`).
 * - Desmarcar es SOFT DELETE estilo Reporte: la fila se CONSERVA con
 *   `activa=false` + `desactivadaEn`/`desactivadaPorId` (respaldo forense,
 *   Ley 1581); el histórico completo sigue consultable con `historial`.
 * - A lo sumo UNA observación activa por estudiante por construcción del
 *   servicio (marcar no crea si ya hay activa).
 *
 * Acepta un cliente transaccional opcional (D2).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export type EstudianteObservacionRow = Prisma.EstudianteObservacionGetPayload<object>;

export interface ResultadoMarcar {
    /** false ≡ ya existía una activa (idempotente, nada nuevo que auditar). */
    creada: boolean;
    observacion: EstudianteObservacionRow;
}

export class EstudianteObservacionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Observación ACTIVA del estudiante, SIEMPRE acotada al colegio. Null si no hay. */
    obtenerActiva(colegioId: string, estudianteId: string): Promise<EstudianteObservacionRow | null> {
        return this.db.estudianteObservacion.findFirst({
            where: { colegioId, estudianteId, activa: true },
        });
    }

    /**
     * Marca al estudiante (idempotente): si ya tiene observación activa devuelve
     * la existente sin crear una segunda (`creada=false`).
     */
    async marcar(
        colegioId: string,
        estudianteId: string,
        datos: { creadaPorId: string; motivo?: string | undefined }
    ): Promise<ResultadoMarcar> {
        const existente = await this.obtenerActiva(colegioId, estudianteId);
        if (existente) return { creada: false, observacion: existente };
        const observacion = await this.db.estudianteObservacion.create({
            data: {
                colegioId,
                estudianteId,
                creadaPorId: datos.creadaPorId,
                motivo: datos.motivo ?? null,
            },
        });
        return { creada: true, observacion };
    }

    /**
     * Desmarca con SOFT DELETE: la fila queda conservada con fecha y actor.
     * Null si no había observación activa (nada que desmarcar).
     */
    async desmarcar(colegioId: string, estudianteId: string, desactivadaPorId: string): Promise<EstudianteObservacionRow | null> {
        const activa = await this.obtenerActiva(colegioId, estudianteId);
        if (!activa) return null;
        return this.db.estudianteObservacion.update({
            where: { id: activa.id },
            data: { activa: false, desactivadaEn: new Date(), desactivadaPorId },
        });
    }

    /** Ids de estudiantes del colegio con observación ACTIVA (flag del DTO del curso). */
    async activasPorColegio(colegioId: string): Promise<Set<string>> {
        const filas = await this.db.estudianteObservacion.findMany({
            where: { colegioId, activa: true },
            select: { estudianteId: true },
        });
        return new Set(filas.map((f) => f.estudianteId));
    }

    /** Histórico COMPLETO del estudiante (activas e inactivas), reciente primero. */
    historial(colegioId: string, estudianteId: string): Promise<EstudianteObservacionRow[]> {
        return this.db.estudianteObservacion.findMany({
            where: { colegioId, estudianteId },
            orderBy: { createdAt: "desc" },
        });
    }
}
