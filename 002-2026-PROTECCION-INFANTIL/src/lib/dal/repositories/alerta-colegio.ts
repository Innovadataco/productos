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
     * SPEC-143 (D2): reportes DISTINTOS del colegio en una ventana sobre
     * `creadoEn` — COUNT(DISTINCT reporteId): un reporte que toca a N
     * estudiantes del colegio cuenta UNA vez. Reportes eliminados no cuentan.
     */
    async contarReportesDistintos(colegioId: string, desde: Date, hasta?: Date): Promise<number> {
        const filas: { total: number }[] = hasta
            ? await this.db.$queryRaw`
                SELECT COUNT(DISTINCT ac."reporteId")::int AS total
                FROM "AlertaColegio" ac
                JOIN "Reporte" r ON r.id = ac."reporteId"
                WHERE ac."colegioId" = ${colegioId}
                  AND r.eliminado = false
                  AND ac."creadoEn" >= ${desde}
                  AND ac."creadoEn" < ${hasta}
            `
            : await this.db.$queryRaw`
                SELECT COUNT(DISTINCT ac."reporteId")::int AS total
                FROM "AlertaColegio" ac
                JOIN "Reporte" r ON r.id = ac."reporteId"
                WHERE ac."colegioId" = ${colegioId}
                  AND r.eliminado = false
                  AND ac."creadoEn" >= ${desde}
            `;
        return filas[0]?.total ?? 0;
    }

    /**
     * SPEC-147 (T002): reportes DISTINTOS (D2) de UN curso en una ventana sobre
     * `creadoEn` — join al estudiante del identificador con tenant en ambos lados
     * (nombres FÍSICOS: "Alumno"/"IdentificadorAlumno"/"alumnoId"). Reportes
     * eliminados no cuentan. `hasta` exclusivo para la ventana anterior (delta).
     */
    async contarReportesDistintosPorCurso(colegioId: string, cursoId: string, desde: Date, hasta?: Date): Promise<number> {
        const filas: { total: number }[] = hasta
            ? await this.db.$queryRaw`
                SELECT COUNT(DISTINCT ac."reporteId")::int AS total
                FROM "AlertaColegio" ac
                JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
                JOIN "Alumno" a ON a.id = i."alumnoId"
                JOIN "Reporte" r ON r.id = ac."reporteId"
                WHERE a."colegioId" = ${colegioId}
                  AND ac."colegioId" = a."colegioId"
                  AND a."cursoId" = ${cursoId}
                  AND r.eliminado = false
                  AND ac."creadoEn" >= ${desde}
                  AND ac."creadoEn" < ${hasta}
            `
            : await this.db.$queryRaw`
                SELECT COUNT(DISTINCT ac."reporteId")::int AS total
                FROM "AlertaColegio" ac
                JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
                JOIN "Alumno" a ON a.id = i."alumnoId"
                JOIN "Reporte" r ON r.id = ac."reporteId"
                WHERE a."colegioId" = ${colegioId}
                  AND ac."colegioId" = a."colegioId"
                  AND a."cursoId" = ${cursoId}
                  AND r.eliminado = false
                  AND ac."creadoEn" >= ${desde}
            `;
        return filas[0]?.total ?? 0;
    }

    /**
     * SPEC-149 (FR-003): reportes DISTINTOS sobre identificadores del MISMO
     * estudiante en una ventana sobre `creadoEn` — aunque sean nicks distintos
     * (join alerta→identificador→estudiante, tenant en el where). Reportes
     * eliminados no cuentan.
     */
    async contarReportesDistintosPorEstudiante(colegioId: string, estudianteId: string, desde: Date): Promise<number> {
        const filas: { total: number }[] = await this.db.$queryRaw`
            SELECT COUNT(DISTINCT ac."reporteId")::int AS total
            FROM "AlertaColegio" ac
            JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
            JOIN "Reporte" r ON r.id = ac."reporteId"
            WHERE ac."colegioId" = ${colegioId}
              AND i."alumnoId" = ${estudianteId}
              AND r.eliminado = false
              AND ac."creadoEn" >= ${desde}
        `;
        return filas[0]?.total ?? 0;
    }

    /** SPEC-143 (D1): contadores del semáforo — nuevas sin gestionar + últimas 72 h. */
    async conteosSemaforo(colegioId: string): Promise<{ alertasNuevas: number; alertas72h: number }> {
        const desde72h = new Date(Date.now() - 72 * 60 * 60 * 1000);
        const [alertasNuevas, alertas72h] = await Promise.all([
            this.db.alertaColegio.count({
                where: { colegioId, estado: "nueva", reporte: { eliminado: false } },
            }),
            this.db.alertaColegio.count({
                where: { colegioId, creadoEn: { gte: desde72h }, reporte: { eliminado: false } },
            }),
        ]);
        return { alertasNuevas, alertas72h };
    }

    /** SPEC-143 (D3-a): última señal sobre el colegio — max(creadoEn); null si nunca hubo. */
    async ultimaSenal(colegioId: string): Promise<Date | null> {
        const resultado = await this.db.alertaColegio.aggregate({
            where: { colegioId },
            _max: { creadoEn: true },
        });
        return resultado._max.creadoEn;
    }

    /**
     * SPEC-143 (D2): serie temporal de reportes DISTINTOS por periodo sobre
     * `creadoEn` (date_trunc en SQL, tenant en el where). Solo los periodos con
     * actividad; el relleno de huecos con ceros es responsabilidad del consumidor.
     */
    async serieReportesPorPeriodo(
        colegioId: string,
        granularidad: "week" | "month" | "year",
        desde: Date
    ): Promise<{ periodo: Date; reportes: number }[]> {
        const filas: { periodo: Date; reportes: number }[] = await this.db.$queryRaw`
            SELECT date_trunc(${granularidad}, ac."creadoEn") AS periodo,
                   COUNT(DISTINCT ac."reporteId")::int AS reportes
            FROM "AlertaColegio" ac
            JOIN "Reporte" r ON r.id = ac."reporteId"
            WHERE ac."colegioId" = ${colegioId}
              AND r.eliminado = false
              AND ac."creadoEn" >= ${desde}
            GROUP BY 1
            ORDER BY 1 ASC
        `;
        return filas;
    }

    /**
     * SPEC-143: top de cursos por reportes DISTINTOS recibidos desde `desde`
     * (home: últimos 30 días), join al curso del estudiante con tenant en ambos
     * lados (mismo patrón que contarVisiblesPorCursoIds).
     */
    async topCursosPorReportes(colegioId: string, desde: Date, limite = 3): Promise<{ cursoId: string; total: number }[]> {
        return this.db.$queryRaw`
            SELECT a."cursoId" AS "cursoId", COUNT(DISTINCT ac."reporteId")::int AS total
            FROM "AlertaColegio" ac
            JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
            JOIN "Alumno" a ON a.id = i."alumnoId"
            JOIN "Reporte" r ON r.id = ac."reporteId"
            WHERE a."colegioId" = ${colegioId}
              AND ac."colegioId" = a."colegioId"
              AND r.eliminado = false
              AND ac."creadoEn" >= ${desde}
            GROUP BY a."cursoId"
            ORDER BY total DESC
            LIMIT ${limite}
        `;
    }

    /**
     * SPEC-158 (T001, FR-003): embudo de estado por reporte DISTINTO (D2), sin
     * solapes — cada reporte cae en UN bucket según el estado más pendiente de
     * sus alertas (nueva > vista > gestionada): "te esperan a ti" si tiene ≥1
     * nueva; si no, "en revisión" si tiene ≥1 vista; si no, "cerrados".
     * recibidos = cerrados + enRevision + teEsperan. Sin ventana temporal: el
     * embudo es el estado actual del colegio. Reportes eliminados no cuentan.
     */
    async embudoPorReporte(colegioId: string): Promise<{ recibidos: number; cerrados: number; enRevision: number; teEsperan: number }> {
        const filas: { bucket: string; total: number }[] = await this.db.$queryRaw`
            SELECT t.bucket, COUNT(*)::int AS total
            FROM (
                SELECT ac."reporteId",
                       CASE
                           WHEN BOOL_OR(ac.estado = 'nueva') THEN 'nueva'
                           WHEN BOOL_OR(ac.estado = 'vista') THEN 'vista'
                           ELSE 'gestionada'
                       END AS bucket
                FROM "AlertaColegio" ac
                JOIN "Reporte" r ON r.id = ac."reporteId"
                WHERE ac."colegioId" = ${colegioId}
                  AND r.eliminado = false
                GROUP BY ac."reporteId"
            ) t
            GROUP BY t.bucket
        `;
        const porBucket = new Map(filas.map((f) => [f.bucket, f.total]));
        const teEsperan = porBucket.get("nueva") ?? 0;
        const enRevision = porBucket.get("vista") ?? 0;
        const cerrados = porBucket.get("gestionada") ?? 0;
        return { recibidos: teEsperan + enRevision + cerrados, cerrados, enRevision, teEsperan };
    }

    /**
     * SPEC-158 (T002, FR-004): reportes DISTINTOS (D2) por hora del día en hora
     * de Colombia (`America/Bogota`, UTC-5 sin DST), todo el histórico — el
     * patrón nocturno es estructural, no del mes. `creadoEn` es TIMESTAMP naive
     * en UTC: primero se reinterpreta como UTC (`AT TIME ZONE 'UTC'`) y luego
     * se convierte a Bogotá. Si la tz no existe en la BD (contenedor sin
     * tzdata), cae a UTC-5 fijo documentado — NUNCA a la hora del servidor.
     * Devuelve exactamente 24 posiciones (0-23) con ceros rellenos.
     */
    async reloj24h(colegioId: string): Promise<number[]> {
        let filas: { hora: number; reportes: number }[];
        try {
            filas = await this.db.$queryRaw`
                SELECT EXTRACT(HOUR FROM ac."creadoEn" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::int AS hora,
                       COUNT(DISTINCT ac."reporteId")::int AS reportes
                FROM "AlertaColegio" ac
                JOIN "Reporte" r ON r.id = ac."reporteId"
                WHERE ac."colegioId" = ${colegioId}
                  AND r.eliminado = false
                GROUP BY 1
            `;
        } catch (error) {
            if (!(error instanceof Error) || !error.message.includes("time zone")) throw error;
            console.warn("[AlertaColegio] reloj24h: tz 'America/Bogota' ausente en la BD — fallback UTC-5 fijo");
            filas = await this.db.$queryRaw`
                SELECT EXTRACT(HOUR FROM ac."creadoEn" - INTERVAL '5 hours')::int AS hora,
                       COUNT(DISTINCT ac."reporteId")::int AS reportes
                FROM "AlertaColegio" ac
                JOIN "Reporte" r ON r.id = ac."reporteId"
                WHERE ac."colegioId" = ${colegioId}
                  AND r.eliminado = false
                GROUP BY 1
            `;
        }
        const porHora = new Map(filas.map((f) => [f.hora, f.reportes]));
        return Array.from({ length: 24 }, (_, hora) => porHora.get(hora) ?? 0);
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

    /**
     * SPEC-149 (FR-003): colegio + estudiante + curso destino de la alerta
     * (evaluador de umbrales, contexto worker — la alerta ya nació tenant-first).
     */
    obtenerDestinoUmbrales(alertaId: string) {
        return this.db.alertaColegio.findUnique({
            where: { id: alertaId },
            select: {
                colegioId: true,
                identificadorEstudiante: {
                    select: { estudiante: { select: { id: true, cursoId: true } } },
                },
            },
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
