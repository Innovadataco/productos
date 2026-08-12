/**
 * SPEC-151 (FR-004): agregaciones mensuales de AlertaColegio para el informe PDF.
 * Extraídas del repo principal para respetar el límite de líneas por archivo.
 */
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class AlertaColegioMensualRepository {
    private readonly db: DbClient;

    constructor(db?: DbClient) {
        this.db = db ?? prisma;
    }

    /** Reportes distintos, alertas totales y cursos afectados en el rango. */
    async resumenMensual(
        colegioId: string,
        inicioMes: Date,
        finMes: Date
    ): Promise<{ reportesDistintos: number; alertasTotales: number; cursosAfectados: number }> {
        const filas: { reportesDistintos: number; alertasTotales: number; cursosAfectados: number }[] = await this.db.$queryRaw`
            SELECT
                COUNT(DISTINCT ac."reporteId")::int AS "reportesDistintos",
                COUNT(*)::int AS "alertasTotales",
                COUNT(DISTINCT a."cursoId")::int AS "cursosAfectados"
            FROM "AlertaColegio" ac
            JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
            JOIN "Alumno" a ON a.id = i."alumnoId"
            JOIN "Reporte" r ON r.id = ac."reporteId"
            WHERE ac."colegioId" = ${colegioId}
              AND a."colegioId" = ${colegioId}
              AND ac."tipoSujeto" = 'ESTUDIANTE'
              AND ac."creadoEn" >= ${inicioMes}
              AND ac."creadoEn" < ${finMes}
              AND r.eliminado = false
        `;
        return filas[0] ?? { reportesDistintos: 0, alertasTotales: 0, cursosAfectados: 0 };
    }

    /** Desglose mensual por curso. Solo cursos con actividad en el mes. */
    async porCursoMensual(
        colegioId: string,
        inicioMes: Date,
        finMes: Date
    ): Promise<{ cursoId: string; nombre: string; reportesDistintos: number; alertasTotales: number }[]> {
        return this.db.$queryRaw`
            SELECT
                a."cursoId" AS "cursoId",
                c.nombre AS nombre,
                COUNT(DISTINCT ac."reporteId")::int AS "reportesDistintos",
                COUNT(*)::int AS "alertasTotales"
            FROM "AlertaColegio" ac
            JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
            JOIN "Alumno" a ON a.id = i."alumnoId"
            JOIN "Curso" c ON c.id = a."cursoId"
            JOIN "Reporte" r ON r.id = ac."reporteId"
            WHERE ac."colegioId" = ${colegioId}
              AND a."colegioId" = ${colegioId}
              AND c."colegioId" = ${colegioId}
              AND ac."tipoSujeto" = 'ESTUDIANTE'
              AND ac."creadoEn" >= ${inicioMes}
              AND ac."creadoEn" < ${finMes}
              AND r.eliminado = false
            GROUP BY a."cursoId", c.nombre
            ORDER BY "reportesDistintos" DESC, c.nombre ASC
        `;
    }

    /** Desglose mensual por categoría de conducta. */
    async porCategoriaMensual(
        colegioId: string,
        inicioMes: Date,
        finMes: Date
    ): Promise<{ categoria: string; reportesDistintos: number; alertasTotales: number }[]> {
        return this.db.$queryRaw`
            SELECT
                cl.categoria::text AS categoria,
                COUNT(DISTINCT ac."reporteId")::int AS "reportesDistintos",
                COUNT(*)::int AS "alertasTotales"
            FROM "AlertaColegio" ac
            JOIN "Reporte" r ON r.id = ac."reporteId"
            JOIN "ClasificacionIA" cl ON cl."reporteId" = r.id
            WHERE ac."colegioId" = ${colegioId}
              AND ac."creadoEn" >= ${inicioMes}
              AND ac."creadoEn" < ${finMes}
              AND r.eliminado = false
            GROUP BY cl.categoria
            ORDER BY "reportesDistintos" DESC, cl.categoria ASC
        `;
    }
}
