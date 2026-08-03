/**
 * SPEC-134 (E-1): repositorio de AlertaColegio — tenant obligatorio por construcción.
 * Toda firma exige `colegioId` y todo `where` lo incluye (la PK compuesta
 * colegioId+reporteId+identificadorEstudianteId ya lo hace estructural en la única).
 * Escrituras por id = `updateMany({ id, colegioId })` con count → 404.
 * Acepta un cliente transaccional opcional (D2).
 */
import { Prisma } from "@prisma/client";
import type { EstadoReporte } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";

/** Estados de la alerta (columna String con valores cerrados, como en lib/colegio/alertas). */
export type EstadoAlertaColegio = "nueva" | "vista" | "gestionada";

const INCLUDE_LISTADO = {
    identificadorEstudiante: {
        select: {
            valor: true,
            etiquetaRelacion: true,
        },
    },
    reporte: {
        select: {
            estado: true,
            clasificacion: {
                select: {
                    categoria: true,
                },
            },
        },
    },
} satisfies Prisma.AlertaColegioInclude;

export type AlertaColegioListadoRow = Prisma.AlertaColegioGetPayload<{ include: typeof INCLUDE_LISTADO }>;

export class AlertaColegioRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Alertas del colegio (reporte no eliminado), filtro de estado tipado. */
    listarPorColegio(colegioId: string, filtros: { estado?: EstadoAlertaColegio | undefined } = {}): Promise<AlertaColegioListadoRow[]> {
        return this.db.alertaColegio.findMany({
            where: {
                colegioId,
                ...(filtros.estado ? { estado: filtros.estado } : {}),
                reporte: { eliminado: false },
            },
            include: INCLUDE_LISTADO,
            orderBy: { creadoEn: "desc" },
        });
    }

    /** Alerta por id, SIEMPRE filtrada por tenant. Null si no existe o es ajena. */
    obtenerPorId(colegioId: string, id: string) {
        return this.db.alertaColegio.findFirst({
            where: { id, colegioId },
        });
    }

    /** Alerta existente para la combinación exacta (dedupe de notificarColegioSiCorresponde). */
    buscarExistente(colegioId: string, reporteId: string, identificadorEstudianteId: string) {
        return this.db.alertaColegio.findUnique({
            where: {
                colegioId_reporteId_identificadorEstudianteId: { colegioId, reporteId, identificadorEstudianteId },
            },
        });
    }

    /** Crea la alerta del colegio en estado "nueva" (el tenant es columna del modelo). */
    crear(datos: { colegioId: string; reporteId: string; identificadorEstudianteId: string }) {
        return this.db.alertaColegio.create({
            data: { ...datos, estado: "nueva" },
        });
    }

    /** Cambia el estado de la alerta. 404 si el id no existe o es de OTRO colegio. */
    async cambiarEstado(colegioId: string, id: string, estado: EstadoAlertaColegio) {
        const { count } = await this.db.alertaColegio.updateMany({
            where: { id, colegioId },
            data: { estado },
        });
        if (count === 0) {
            throw new AppError("Alerta no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.alertaColegio.findUniqueOrThrow({ where: { id } });
    }

    /** Total de alertas con reporte visible (totales generales de estadísticas). */
    contarVisiblesPorColegio(colegioId: string, estadosVisibles: EstadoReporte[]): Promise<number> {
        return this.db.alertaColegio.count({
            where: {
                colegioId,
                reporte: {
                    eliminado: false,
                    estado: { in: estadosVisibles },
                },
            },
        });
    }

    /** Conteo de alertas visibles agrupado por curso (join, tenant en ambos lados). */
    async contarVisiblesPorCursoIds(colegioId: string, cursoIds: string[], estadosVisibles: EstadoReporte[]): Promise<Map<string, number>> {
        if (cursoIds.length === 0) return new Map();
        const resultados: { cursoId: string; total: bigint }[] = await this.db.$queryRaw`
            SELECT a."cursoId" as "cursoId", COUNT(*) as total
            FROM "AlertaColegio" ac
            JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
            JOIN "Alumno" a ON a.id = i."alumnoId"
            JOIN "Reporte" r ON r.id = ac."reporteId"
            WHERE a."colegioId" = ${colegioId}
              AND a."cursoId" IN (${Prisma.join(cursoIds)})
              AND ac."colegioId" = a."colegioId"
              AND r.eliminado = false
              AND r.estado::text IN (${Prisma.join(estadosVisibles)})
            GROUP BY a."cursoId"
        `;
        return new Map(resultados.map((r) => [r.cursoId, Number(r.total)]));
    }

    /**
     * SPEC-142 (F6) — EXCEPCIÓN cross-tenant (como buscarActivosPorValor): las
     * alertas de UN reporte con su vínculo y el grado del curso, más antiguas
     * primero (dedupe determinístico por colegio y snapshot del grado).
     */
    findPorReporteConVinculoYGrado(reporteId: string) {
        return this.db.alertaColegio.findMany({
            where: { reporteId },
            orderBy: { creadoEn: "asc" },
            select: {
                id: true,
                colegioId: true,
                patronInstitucionalId: true,
                identificadorEstudiante: {
                    select: {
                        estudiante: { select: { colegioId: true, curso: { select: { grado: true } } } },
                    },
                },
            },
        });
    }

    /** SPEC-142 (F6): marca la fila agregada que aportó esta alerta (idempotencia). */
    marcarPatron(id: string, patronInstitucionalId: string) {
        return this.db.alertaColegio.update({
            where: { id },
            data: { patronInstitucionalId },
        });
    }

    /** SPEC-142 (F6): alertas del reporte con aporte al agregado (reversa en baja). */
    findPorReporteConPatron(reporteId: string) {
        return this.db.alertaColegio.findMany({
            where: { reporteId, patronInstitucionalId: { not: null } },
            select: { id: true, patronInstitucionalId: true },
        });
    }

    /** SPEC-142 (F6): limpia el marcador tras revertir (re-baja no re-decrementa). */
    desmarcarPatron(id: string) {
        return this.db.alertaColegio.update({
            where: { id },
            data: { patronInstitucionalId: null },
        });
    }
}
