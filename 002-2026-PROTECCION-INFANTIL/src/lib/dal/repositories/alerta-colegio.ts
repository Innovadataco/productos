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
export type EstadoAlertaColegio = "nueva" | "vista" | "gestionada" | "escalada" | "cerrada";

/**
 * Tipo de sujeto al que apunta la alerta (SPEC-165 · ampliado SPEC-380 PR B con
 * `INTEGRANTE_COMITE`). Es una UNIÓN cerrada: el compilador debe fallar si
 * alguien agrega un valor sin cubrir todas las ramas (Records completos +
 * `switch` exhaustivo con `never`). Un guardián que avisa vale más que uno
 * que perdona — regla del CEO tras SPEC-165.
 */
export type TipoSujeto = "ESTUDIANTE" | "PROFESOR" | "ACUDIENTE" | "INTEGRANTE_COMITE";
export const TIPOS_SUJETO_VALIDOS: readonly TipoSujeto[] = [
    "ESTUDIANTE",
    "PROFESOR",
    "ACUDIENTE",
    "INTEGRANTE_COMITE",
];

/** Input discriminated para crear una alerta sobre un sujeto específico. */
export type CrearAlertaInput =
    | { tipoSujeto: "ESTUDIANTE"; identificadorEstudianteId: string }
    | { tipoSujeto: "PROFESOR"; identificadorProfesorId: string }
    | { tipoSujeto: "ACUDIENTE"; identificadorAcudienteId: string }
    | { tipoSujeto: "INTEGRANTE_COMITE"; identificadorIntegranteComiteId: string };

const INCLUDE_LISTADO = {
    identificadorEstudiante: {
        select: {
            valor: true,
            etiquetaRelacion: true,
            estudiante: { select: { nombre: true, apellidos: true } },
        },
    },
    identificadorProfesor: {
        select: {
            profesor: { select: { nombre: true, apellidos: true } },
        },
    },
    identificadorAcudiente: {
        select: {
            acudiente: { select: { nombre: true, relacion: true } },
        },
    },
    // SPEC-380 (PR B): 4ª relación en el include del listado.
    identificadorIntegranteComite: {
        select: {
            valor: true,
            integrante: { select: { nombres: true, apellidos: true, cargo: true } },
        },
    },
    asignadoA: { select: { id: true, nombre: true, email: true } },
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

    /** Alertas del colegio (reporte no eliminado), filtro de estado y tipo de sujeto. */
    listarPorColegio(
        colegioId: string,
        filtros: { estado?: EstadoAlertaColegio | undefined; tipoSujeto?: TipoSujeto | undefined } = {}
    ): Promise<AlertaColegioListadoRow[]> {
        return this.db.alertaColegio.findMany({
            where: {
                colegioId,
                ...(filtros.estado ? { estado: filtros.estado } : {}),
                ...(filtros.tipoSujeto ? { tipoSujeto: filtros.tipoSujeto } : {}),
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

    /**
     * Alerta existente para la combinación exacta (dedupe de notificarColegioSiCorresponde).
     * Elige el índice único según el tipo de sujeto.
     */
    buscarExistente(colegioId: string, reporteId: string, input: CrearAlertaInput) {
        // Candado exhaustivo (SPEC-380 · CEO): `switch` con `never` en default
        // — si mañana entra un 5º valor y olvidan una rama, el compilador falla.
        switch (input.tipoSujeto) {
            case "ESTUDIANTE":
                return this.db.alertaColegio.findUnique({
                    where: {
                        colegioId_reporteId_identificadorEstudianteId: {
                            colegioId,
                            reporteId,
                            identificadorEstudianteId: input.identificadorEstudianteId,
                        },
                    },
                });
            case "PROFESOR":
                return this.db.alertaColegio.findUnique({
                    where: {
                        colegioId_reporteId_identificadorProfesorId: {
                            colegioId,
                            reporteId,
                            identificadorProfesorId: input.identificadorProfesorId,
                        },
                    },
                });
            case "ACUDIENTE":
                return this.db.alertaColegio.findUnique({
                    where: {
                        colegioId_reporteId_identificadorAcudienteId: {
                            colegioId,
                            reporteId,
                            identificadorAcudienteId: input.identificadorAcudienteId,
                        },
                    },
                });
            case "INTEGRANTE_COMITE":
                return this.db.alertaColegio.findUnique({
                    where: {
                        colegioId_reporteId_identificadorIntegranteComiteId: {
                            colegioId,
                            reporteId,
                            identificadorIntegranteComiteId: input.identificadorIntegranteComiteId,
                        },
                    },
                });
            default: {
                const _exhaustive: never = input;
                throw new Error(`TipoSujeto no cubierto: ${JSON.stringify(_exhaustive)}`);
            }
        }
    }

    /** Crea la alerta del colegio en estado "nueva" para el sujeto indicado. */
    crear(
        datos: { colegioId: string; reporteId: string; prioridad?: "alta" | "media" | "baja"; vencimientoSla?: Date } & CrearAlertaInput
    ) {
        const ahora = new Date();
        const base = {
            colegioId: datos.colegioId,
            reporteId: datos.reporteId,
            estado: "nueva" as const,
            prioridad: datos.prioridad ?? ("media" as const),
            vencimientoSla: datos.vencimientoSla ?? new Date(ahora.getTime() + 48 * 60 * 60 * 1000),
        };
        switch (datos.tipoSujeto) {
            case "ESTUDIANTE":
                return this.db.alertaColegio.create({
                    data: { ...base, tipoSujeto: "ESTUDIANTE", identificadorEstudianteId: datos.identificadorEstudianteId },
                });
            case "PROFESOR":
                return this.db.alertaColegio.create({
                    data: { ...base, tipoSujeto: "PROFESOR", identificadorProfesorId: datos.identificadorProfesorId },
                });
            case "ACUDIENTE":
                return this.db.alertaColegio.create({
                    data: { ...base, tipoSujeto: "ACUDIENTE", identificadorAcudienteId: datos.identificadorAcudienteId },
                });
            case "INTEGRANTE_COMITE":
                return this.db.alertaColegio.create({
                    data: {
                        ...base,
                        tipoSujeto: "INTEGRANTE_COMITE",
                        identificadorIntegranteComiteId: datos.identificadorIntegranteComiteId,
                    },
                });
            default: {
                const _exhaustive: never = datos;
                throw new Error(`TipoSujeto no cubierto: ${JSON.stringify(_exhaustive)}`);
            }
        }
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

    /**
     * SPEC-173 (H04) · SPEC-380 (PR B): alertas visibles agrupadas por tipo de
     * sujeto. El shape del retorno es `Record<TipoSujeto, number>` completo —
     * agregar un 5º sujeto sin ampliar acá hace fallar el compilador.
     */
    async contarPorTipoSujeto(
        colegioId: string,
        estadosVisibles: EstadoReporte[]
    ): Promise<Record<TipoSujeto, number>> {
        const grupos = await this.db.alertaColegio.groupBy({
            by: ["tipoSujeto"],
            where: {
                colegioId,
                reporte: {
                    eliminado: false,
                    estado: { in: estadosVisibles },
                },
            },
            _count: { _all: true },
        });
        const totales: Record<TipoSujeto, number> = {
            ESTUDIANTE: 0,
            PROFESOR: 0,
            ACUDIENTE: 0,
            INTEGRANTE_COMITE: 0,
        };
        for (const grupo of grupos) {
            if ((TIPOS_SUJETO_VALIDOS as readonly string[]).includes(grupo.tipoSujeto)) {
                totales[grupo.tipoSujeto as TipoSujeto] = grupo._count._all;
            }
        }
        return totales;
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
              AND ac."tipoSujeto" = 'ESTUDIANTE'
              AND r.eliminado = false
              AND r.estado::text IN (${Prisma.join(estadosVisibles)})
            GROUP BY a."cursoId"
        `;
        return new Map(resultados.map((r) => [r.cursoId, Number(r.total)]));
    }

    /** SPEC-143 (D2): reportes DISTINTOS del colegio en ventana sobre `creadoEn`. */
    async contarReportesDistintos(colegioId: string, desde: Date, hasta?: Date): Promise<number> {
        const hastaSql = hasta ? Prisma.sql`AND ac."creadoEn" < ${hasta}` : Prisma.sql``;
        const filas: { total: number }[] = await this.db.$queryRaw(Prisma.sql`
            SELECT COUNT(DISTINCT ac."reporteId")::int AS total
            FROM "AlertaColegio" ac
            JOIN "Reporte" r ON r.id = ac."reporteId"
            WHERE ac."colegioId" = ${colegioId}
              AND r.eliminado = false
              AND ac."creadoEn" >= ${desde}
              ${hastaSql}
        `);
        return filas[0]?.total ?? 0;
    }

    /** SPEC-147 (T002): reportes DISTINTOS (D2) de UN curso en ventana sobre `creadoEn`. */
    async contarReportesDistintosPorCurso(colegioId: string, cursoId: string, desde: Date, hasta?: Date): Promise<number> {
        const hastaSql = hasta ? Prisma.sql`AND ac."creadoEn" < ${hasta}` : Prisma.sql``;
        const filas: { total: number }[] = await this.db.$queryRaw(Prisma.sql`
            SELECT COUNT(DISTINCT ac."reporteId")::int AS total
            FROM "AlertaColegio" ac
            JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
            JOIN "Alumno" a ON a.id = i."alumnoId"
            JOIN "Reporte" r ON r.id = ac."reporteId"
            WHERE a."colegioId" = ${colegioId}
              AND ac."colegioId" = a."colegioId"
              AND a."cursoId" = ${cursoId}
              AND ac."tipoSujeto" = 'ESTUDIANTE'
              AND r.eliminado = false
              AND ac."creadoEn" >= ${desde}
              ${hastaSql}
        `);
        return filas[0]?.total ?? 0;
    }

    /** SPEC-149 (FR-003): reportes DISTINTOS sobre identificadores del MISMO estudiante. */
    async contarReportesDistintosPorEstudiante(colegioId: string, estudianteId: string, desde: Date): Promise<number> {
        const filas: { total: number }[] = await this.db.$queryRaw`
            SELECT COUNT(DISTINCT ac."reporteId")::int AS total
            FROM "AlertaColegio" ac
            JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
            JOIN "Reporte" r ON r.id = ac."reporteId"
            WHERE ac."colegioId" = ${colegioId}
              AND i."alumnoId" = ${estudianteId}
              AND ac."tipoSujeto" = 'ESTUDIANTE'
              AND r.eliminado = false
              AND ac."creadoEn" >= ${desde}
        `;
        return filas[0]?.total ?? 0;
    }

    /**
     * SPEC-353 (A-69 · C6 · FR-004): identificador CRUZADO — un mismo
     * identificador de estudiante presente en alertas visibles de los últimos
     * 7 días que tocan a MÁS de un estudiante distinto. Es la señal más grave
     * del dominio (posible depredador contactando a varios menores) y el
     * mockup 2.1 la pinta como la frase principal del puesto de mando.
     *
     * OJO privacidad (SC-005): devuelve SOLO conteos — jamás el valor del
     * identificador. El cruce es por VALOR NORMALIZADO del identificador
     * (mismo nick en cuentas de dos estudiantes distintos), no por id de fila
     * (un id de IdentificadorAlumno pertenece a UN estudiante por diseño).
     */
    async identificadorCruzado7d(
        colegioId: string,
    ): Promise<{ identificadores: number; estudiantesMax: number }> {
        const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const filas: { identificadores: number; estudiantes_max: number }[] = await this.db.$queryRaw`
            SELECT COUNT(*)::int AS identificadores,
                   COALESCE(MAX(estudiantes), 0)::int AS estudiantes_max
            FROM (
                SELECT i.valor, COUNT(DISTINCT i."alumnoId")::int AS estudiantes
                FROM "AlertaColegio" ac
                JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
                JOIN "Reporte" r ON r.id = ac."reporteId"
                WHERE ac."colegioId" = ${colegioId}
                  AND ac."tipoSujeto" = 'ESTUDIANTE'
                  AND r.eliminado = false
                  AND ac."creadoEn" >= ${desde}
                GROUP BY i.valor
                HAVING COUNT(DISTINCT i."alumnoId") > 1
            ) cruzados
        `;
        return {
            identificadores: filas[0]?.identificadores ?? 0,
            estudiantesMax: filas[0]?.estudiantes_max ?? 0,
        };
    }

    /**
     * SPEC-353 (C6): fecha de la alerta "nueva" más reciente — para la frase
     * calmada ("Todo al día. La última señal llegó el …") y la urgente.
     */
    async ultimaAlertaSinAbrir(colegioId: string): Promise<Date | null> {
        const resultado = await this.db.alertaColegio.aggregate({
            where: { colegioId, estado: "nueva", reporte: { eliminado: false } },
            _max: { creadoEn: true },
        });
        return resultado._max.creadoEn;
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

    /** SPEC-143 (D2): serie temporal de reportes DISTINTOS por periodo sobre `creadoEn`. */
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

    /** SPEC-143: top de cursos por reportes DISTINTOS recibidos desde `desde`. */
    async topCursosPorReportes(colegioId: string, desde: Date, limite = 3): Promise<{ cursoId: string; total: number }[]> {
        return this.db.$queryRaw`
            SELECT a."cursoId" AS "cursoId", COUNT(DISTINCT ac."reporteId")::int AS total
            FROM "AlertaColegio" ac
            JOIN "IdentificadorAlumno" i ON i.id = ac."identificadorAlumnoId"
            JOIN "Alumno" a ON a.id = i."alumnoId"
            JOIN "Reporte" r ON r.id = ac."reporteId"
            WHERE a."colegioId" = ${colegioId}
              AND ac."colegioId" = a."colegioId"
              AND ac."tipoSujeto" = 'ESTUDIANTE'
              AND r.eliminado = false
              AND ac."creadoEn" >= ${desde}
            GROUP BY a."cursoId"
            ORDER BY total DESC
            LIMIT ${limite}
        `;
    }

    /**
     * SPEC-158 (T001, FR-003): embudo de estado por reporte DISTINTO (D2).
     * Bucket: nueva > vista > gestionada. recibidos = suma de los tres.
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
     * SPEC-158 (T002, FR-004): reportes DISTINTOS (D2) por hora del día en hora de Colombia.
     * Fallback a UTC-5 fijo si la tz no existe en la BD.
     */
    async reloj24h(colegioId: string): Promise<number[]> {
        let filas: { hora: number; reportes: number }[];
        try {
            // SPEC-200: creadoEn es Timestamptz; convertir directamente a America/Bogota.
            filas = await this.db.$queryRaw`
                SELECT EXTRACT(HOUR FROM ac."creadoEn" AT TIME ZONE 'America/Bogota')::int AS hora,
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
                SELECT EXTRACT(HOUR FROM (ac."creadoEn" AT TIME ZONE 'UTC') - INTERVAL '5 hours')::int AS hora,
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
            where: { reporteId, tipoSujeto: "ESTUDIANTE" },
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
                tipoSujeto: true,
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

    /**
     * SPEC-159 (FR-002): detalle del caso para el colegio — SIEMPRE filtrado por
     * tenant (null si no existe o es ajeno). Resumen visible: estudiante
     * (nombre+apellidos), curso, plataforma y TIPO de identificador — NUNCA el
     * valor del identificador ni el texto del reporte ni scores (I-28/I-29).
     */
    obtenerDetalleConCurso(colegioId: string, id: string) {
        return this.db.alertaColegio.findFirst({
            where: { id, colegioId },
            select: {
                id: true,
                colegioId: true,
                reporteId: true,
                estado: true,
                tipoSujeto: true,
                creadoEn: true,
                reporte: {
                    select: {
                        estado: true,
                        clasificacion: { select: { categoria: true } },
                    },
                },
                identificadorEstudiante: {
                    select: {
                        tipo: true,
                        etiquetaRelacion: true,
                        plataforma: { select: { nombre: true } },
                        estudiante: {
                            select: {
                                nombre: true,
                                apellidos: true,
                                curso: { select: { nombre: true, grado: true } },
                            },
                        },
                    },
                },
                identificadorProfesor: {
                    select: {
                        tipo: true,
                        plataforma: { select: { nombre: true } },
                        profesor: { select: { nombre: true, apellidos: true } },
                    },
                },
                identificadorAcudiente: {
                    select: {
                        tipo: true,
                        plataforma: { select: { nombre: true } },
                        acudiente: { select: { nombre: true, relacion: true } },
                    },
                },
                // SPEC-380 (PR B): 4º sujeto — integrante del comité.
                identificadorIntegranteComite: {
                    select: {
                        tipo: true,
                        plataforma: { select: { nombre: true } },
                        integrante: { select: { nombres: true, apellidos: true, cargo: true } },
                    },
                },
            },
        });
    }
}
