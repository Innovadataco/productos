/**
 * SPEC-053 (US3, módulo IA): IaEvalsService.
 * Corridas de evaluación (f7), banco de casos y laboratorio de experimentos.
 * Los adaptadores de infra (pg-boss, Ollama, eval-runner) los orquesta la ruta;
 * aquí vive el acceso a datos, la agregación y la auditoría. Acepta tx opcional (D2).
 */
import { CasoEvalFuente, EvalRunEstado, type Prisma } from "@prisma/client";
import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { aJson } from "../json";
import {
    getCurrentProductionConfig,
    type ExperimentConfigSnapshot,
    type F7Report,
} from "@/lib/ai/eval-runner";
import { EvalRunRepository } from "../repositories/eval-run";
import { CasoEvalRepository } from "../repositories/caso-eval";
import { EvalResultadoRepository } from "../repositories/eval-resultado";
import type { InfoClienteDto } from "../types/operador";

const HISTORIAL_POR_PAGINA = 20;
const CASOS_POR_PAGINA = 25;
const EXPERIMENTOS_POR_PAGINA = 20;
const RESULTADOS_POR_PAGINA = 50;

interface RunMetrics {
    accuracy: number;
    errorSilencioso: number;
    revisionManualRate: number;
}

// SPEC-136 (E-3): el JSON de corridas lo escribe eval-runner; en la lectura se
// valida la parte consumida con Zod en lugar de afirmarla con casts. Los tres
// bloques consumidos son opcionales (las corridas antiguas y los baselines
// pueden traer solo `metrics` — mismo nivel de tolerancia que el código previo).
const runMetricsResumenSchema = z.object({
    accuracy: z.number(),
    errorSilencioso: z.number(),
    revisionManualRate: z.number(),
});

const runMetricsSchema = runMetricsResumenSchema.extend({
    precisionAutoClasificados: z.number(),
    latencyP50Ms: z.number(),
    latencyP95Ms: z.number(),
    posibleAgresorParRate: z.number(),
    recallOTRO: z.number(),
});

const f7ReportConsumidoSchema = z.object({
    metrics: runMetricsSchema.optional(),
    perCategory: z
        .record(z.string(), z.object({ precision: z.number(), recall: z.number(), f1: z.number(), support: z.number() }))
        .optional(),
    operational: z
        .object({
            duracionTotalMs: z.number(),
            casosPorMinuto: z.number(),
            tasaFallbacks: z.number(),
            activacionesGuardas: z.number(),
            doxingVerdaderas: z.number(),
            keywordsActivadas: z.number(),
            prioridadAltaTotal: z.number(),
        })
        .optional(),
});

/** Guard: el JSON persistido por eval-runner tiene la forma F7Report (parte consumida). */
function esF7Report(valor: unknown): valor is F7Report {
    return f7ReportConsumidoSchema.safeParse(valor).success;
}

/** Guard: objeto con `metrics` del resumen usado en la comparación entre corridas. */
function esObjetoConMetricsResumen(valor: unknown): valor is { metrics: RunMetrics } {
    if (!valor || typeof valor !== "object") return false;
    return runMetricsResumenSchema.safeParse((valor as Record<string, unknown>).metrics).success;
}

const experimentConfigSnapshotSchema = z.object({
    modeloClasificacion: z.string(),
    modeloEmbedding: z.string(),
    umbralRevision: z.number(),
    nVotos: z.number(),
    temperaturaVotos: z.number(),
    ragTopK: z.number(),
    ollamaBaseUrl: z.string(),
    fixtureVersion: z.number(),
    // SPEC-138 (E-7): aditivo y tolerante — históricos sin el campo pasan igual.
    motorUsado: z.enum(["rubrica", "legacy"]).optional(),
});

/** Guard: el configSnapshot persistido tiene la forma ExperimentConfigSnapshot. */
function esExperimentConfigSnapshot(valor: unknown): valor is ExperimentConfigSnapshot {
    return experimentConfigSnapshotSchema.safeParse(valor).success;
}

export interface FiltrosCasosEval {
    categoria?: string | undefined;
    ruido?: boolean | undefined;
    fuente?: string | undefined;
    activo?: boolean | undefined;
    page: number;
}

export interface CrearCasoEvalInput {
    texto: string;
    categoriaEsperada: string;
    secundariaEsperada?: string | undefined;
    ruido: boolean;
}

export type ResultadoComparacionExperimentos =
    | { comparable: false; fixtureVersions: number[] }
    | {
          comparable: true;
          fixtureVersion: number;
          experimentos: Array<{
              id: string;
              nombre: string | null;
              fixtureVersion: number;
              configSnapshot: unknown;
              estado: "COMPLETADA";
              metrics: F7Report["metrics"] | null;
              perCategory: F7Report["perCategory"] | null;
              operational: F7Report["operational"] | null;
          }>;
          frontier: Array<{ casoEvalId: string; resultados: Record<string, boolean> }>;
      };

function getMetrics(run: {
    resultadoJson: unknown | null;
    configSnapshot: unknown | null;
    fixtureVersion: number;
    nombre: string | null;
    id: string;
}) {
    const report = esF7Report(run.resultadoJson) ? run.resultadoJson : null;
    return {
        id: run.id,
        nombre: run.nombre,
        fixtureVersion: run.fixtureVersion,
        configSnapshot: run.configSnapshot,
        estado: "COMPLETADA" as const,
        metrics: report?.metrics || null,
        perCategory: report?.perCategory || null,
        operational: report?.operational || null,
    };
}

export class IaEvalsService {
    private readonly evalRuns: EvalRunRepository;
    private readonly casos: CasoEvalRepository;
    private readonly resultados: EvalResultadoRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.evalRuns = new EvalRunRepository(tx);
        this.casos = new CasoEvalRepository(tx);
        this.resultados = new EvalResultadoRepository(tx);
    }

    /** Guarda de corrida única (POST /evals y POST /experimentos): 409 si hay una en curso. */
    async assertSinCorridaEnCurso() {
        const enProgreso = await this.evalRuns.findEnProgreso();
        if (enProgreso) {
            throw new AppError(
                `Ya hay una corrida en curso (${enProgreso.id}). Espere a que termine.`,
                ERROR_CODES.CONFLICT,
                409
            );
        }
    }

    /** POST /api/admin/ia/evals — crea la corrida PENDIENTE (el encolado lo hace la ruta). */
    crearCorridaEval(input: { fixtureVersion: number; creadoPorId: string }) {
        return this.evalRuns.crear({
            tipo: "f7",
            fixtureVersion: input.fixtureVersion,
            estado: EvalRunEstado.PENDIENTE,
            creadoPorId: input.creadoPorId,
        });
    }

    /** GET /api/admin/ia/evals/[id] — corrida + comparación con la anterior de la misma fixture. */
    async obtenerCorrida(id: string) {
        const run = await this.evalRuns.findByIdConCreador(id);
        if (!run) {
            throw new AppError("Corrida no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        // Comparación con la corrida anterior de la misma fixtureVersion
        let comparacion = null;
        if (run.estado === "COMPLETADA" && run.resultadoJson) {
            const anterior = await this.evalRuns.findAnteriorCompletada(run.fixtureVersion, run.id);
            if (anterior && esObjetoConMetricsResumen(run.resultadoJson) && esObjetoConMetricsResumen(anterior.resultadoJson)) {
                comparacion = {
                    accuracyDelta: run.resultadoJson.metrics.accuracy - anterior.resultadoJson.metrics.accuracy,
                    errorSilenciosoDelta: run.resultadoJson.metrics.errorSilencioso - anterior.resultadoJson.metrics.errorSilencioso,
                    revisionManualRateDelta: run.resultadoJson.metrics.revisionManualRate - anterior.resultadoJson.metrics.revisionManualRate,
                    anteriorId: anterior.id,
                    anteriorFinalizadoEn: anterior.finalizadoEn,
                };
            }
        }

        return { run, comparacion };
    }

    /** GET /api/admin/ia/evals/historial — corridas paginadas con métricas resumidas. */
    async listarHistorial(fixtureVersionRaw: string | null, page: number) {
        const where: Prisma.EvalRunWhereInput = fixtureVersionRaw
            ? { fixtureVersion: parseInt(fixtureVersionRaw, 10) }
            : {};

        const [items, total] = await this.evalRuns.findPaginadosConTotal(where, {
            skip: (page - 1) * HISTORIAL_POR_PAGINA,
            take: HISTORIAL_POR_PAGINA,
        });

        const summary = items.map((r) => ({
            id: r.id,
            tipo: r.tipo,
            fixtureVersion: r.fixtureVersion,
            estado: r.estado,
            iniciadoEn: r.iniciadoEn,
            finalizadoEn: r.finalizadoEn,
            error: r.error,
            metricas:
                r.estado === "COMPLETADA" && r.resultadoJson
                    ? {
                          accuracy: (r.resultadoJson as { metrics: { accuracy: number } }).metrics.accuracy,
                          errorSilencioso: (r.resultadoJson as { metrics: { errorSilencioso: number } }).metrics
                              .errorSilencioso,
                          revisionManualRate: (r.resultadoJson as { metrics: { revisionManualRate: number } }).metrics
                              .revisionManualRate,
                      }
                    : null,
            creadoPor: r.creadoPor,
        }));

        return {
            items: summary,
            pagination: { page, totalPages: Math.ceil(total / HISTORIAL_POR_PAGINA), total },
        };
    }

    /** GET /api/admin/ia/evals/casos — banco paginado + conteos por categoría (activos). */
    async listarCasos(filtros: FiltrosCasosEval) {
        const where: Prisma.CasoEvalWhereInput = {};
        if (filtros.categoria) where.categoriaEsperada = filtros.categoria;
        if (filtros.ruido !== undefined) where.ruido = filtros.ruido;
        if (filtros.fuente) where.fuente = filtros.fuente as CasoEvalFuente;
        if (filtros.activo !== undefined) where.activo = filtros.activo;

        const [items, total] = await this.casos.findPaginadosConTotal(where, {
            skip: (filtros.page - 1) * CASOS_POR_PAGINA,
            take: CASOS_POR_PAGINA,
        });
        const porCategoria = await this.casos.groupByCategoriaActivos();

        const conteosPorCategoria = Object.fromEntries(
            porCategoria.map((g) => [g.categoriaEsperada, (g._count as { categoriaEsperada: number }).categoriaEsperada ?? 0])
        );

        return {
            items,
            pagination: { page: filtros.page, totalPages: Math.ceil(total / CASOS_POR_PAGINA), total },
            conteosPorCategoria,
        };
    }

    /** POST /api/admin/ia/evals/casos — alta manual con nueva fixtureVersion y auditoría. */
    async crearCaso(data: CrearCasoEvalInput, usuarioId: string, info: InfoClienteDto) {
        const nextVersion = await this.casos.nextFixtureVersion();

        const creado = await this.casos.crear({
            texto: data.texto,
            categoriaEsperada: data.categoriaEsperada,
            secundariaEsperada: data.secundariaEsperada || null,
            ruido: data.ruido,
            fuente: CasoEvalFuente.MANUAL_ADMIN,
            activo: true,
            fixtureVersion: nextVersion,
            creadoPorId: usuarioId,
        });

        await logAudit({
            accion: "EVAL_CASE_CREATE",
            tipoRecurso: "CasoEval",
            recursoId: creado.id,
            usuarioId,
            valorNuevo: JSON.stringify({
                categoriaEsperada: creado.categoriaEsperada,
                secundariaEsperada: creado.secundariaEsperada,
                ruido: creado.ruido,
                fixtureVersion: creado.fixtureVersion,
            }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return { caso: creado, fixtureVersion: nextVersion };
    }

    /** PATCH /api/admin/ia/evals/casos/[id]/desactivar — baja lógica con auditoría. */
    async desactivarCaso(id: string, usuarioId: string, info: InfoClienteDto) {
        const caso = await this.casos.findById(id);
        if (!caso) {
            throw new AppError("Caso no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (!caso.activo) {
            throw new AppError("El caso ya está desactivado", ERROR_CODES.CONFLICT, 409);
        }

        const nextVersion = await this.casos.nextFixtureVersion();

        const actualizado = await this.casos.actualizar(id, { activo: false, fixtureVersion: nextVersion });

        await logAudit({
            accion: "EVAL_CASE_DISABLE",
            tipoRecurso: "CasoEval",
            recursoId: id,
            usuarioId,
            valorAnterior: JSON.stringify({ activo: true, fixtureVersion: caso.fixtureVersion }),
            valorNuevo: JSON.stringify({ activo: false, fixtureVersion: nextVersion }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return { caso: actualizado, fixtureVersion: nextVersion };
    }

    /** Casos activos del banco (guarda "hay casos para evaluar" de POST /experimentos). */
    contarCasosActivos() {
        return this.casos.countActivos();
    }

    /** POST /api/admin/ia/experimentos — crea el experimento PENDIENTE con su snapshot. */
    crearExperimento(input: {
        nombre: string;
        notas?: string | undefined;
        configSnapshot: ExperimentConfigSnapshot;
        totalCasos: number;
        creadoPorId: string;
    }) {
        return this.evalRuns.crear({
            tipo: "f7",
            fixtureVersion: input.configSnapshot.fixtureVersion,
            estado: EvalRunEstado.PENDIENTE,
            creadoPorId: input.creadoPorId,
            nombre: input.nombre,
            notas: input.notas || null,
            configSnapshot: aJson(input.configSnapshot),
            progresoTotal: input.totalCasos,
        });
    }

    /** Auditoría del inicio de experimento (la ruta la emite tras encolar el job). */
    async auditarInicioExperimento(input: {
        runId: string;
        nombre: string | null;
        configSnapshot: ExperimentConfigSnapshot;
        adminId: string;
        info: InfoClienteDto;
    }) {
        await logAudit({
            accion: "EXPERIMENT_START",
            tipoRecurso: "EvalRun",
            recursoId: input.runId,
            usuarioId: input.adminId,
            valorNuevo: JSON.stringify({ nombre: input.nombre, configSnapshot: input.configSnapshot }),
            ipAddress: input.info.ipAddress,
            userAgent: input.info.userAgent,
        });
    }

    /** GET /api/admin/ia/experimentos — listado paginado de experimentos. */
    async listarExperimentos(filtros: { estado?: string | undefined; fixtureVersionRaw: string | null; page: number }) {
        const where: Prisma.EvalRunWhereInput = {};
        if (filtros.estado) where.estado = filtros.estado as EvalRunEstado;
        if (filtros.fixtureVersionRaw) where.fixtureVersion = parseInt(filtros.fixtureVersionRaw, 10);

        const [items, total] = await this.evalRuns.findPaginadosConTotal(where, {
            skip: (filtros.page - 1) * EXPERIMENTOS_POR_PAGINA,
            take: EXPERIMENTOS_POR_PAGINA,
        });

        return {
            items,
            pagination: { page: filtros.page, totalPages: Math.ceil(total / EXPERIMENTOS_POR_PAGINA), total },
        };
    }

    /** GET /api/admin/ia/experimentos/[id] — detalle con métricas y baseline de producción. */
    async obtenerExperimento(id: string) {
        const run = await this.evalRuns.findByIdConCreador(id);
        if (!run) {
            throw new AppError("Experimento no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const productionConfig = await getCurrentProductionConfig();
        const snapshot = (run.configSnapshot || {}) as Record<string, unknown>;
        const isBaseline =
            run.estado === "COMPLETADA" &&
            snapshot.modeloClasificacion === productionConfig.modeloClasificacion &&
            snapshot.umbralRevision === productionConfig.umbralRevision &&
            snapshot.nVotos === productionConfig.nVotos &&
            snapshot.temperaturaVotos === productionConfig.temperaturaVotos &&
            snapshot.ragTopK === productionConfig.ragTopK;

        const baseline = isBaseline
            ? null
            : await this.evalRuns.findBaseline(
                  run.fixtureVersion,
                  aJson(productionConfig)
              );

        const resultadoJson = esF7Report(run.resultadoJson) ? run.resultadoJson : null;
        const metrics = resultadoJson?.metrics || null;

        const baselineReport = baseline && esF7Report(baseline.resultadoJson) ? baseline.resultadoJson : null;

        return {
            experimento: run,
            metrics,
            perCategory: resultadoJson?.perCategory || null,
            operational: resultadoJson?.operational || null,
            baseline: baseline
                ? {
                      id: baseline.id,
                      nombre: baseline.nombre,
                      metrics: baselineReport?.metrics || null,
                  }
                : null,
            baselineMissing: !baseline && run.estado === "COMPLETADA" && !isBaseline,
        };
    }

    /** POST .../preparar-activacion — snapshot validado del experimento COMPLETADA. */
    async obtenerSnapshotActivacion(id: string): Promise<ExperimentConfigSnapshot> {
        const run = await this.evalRuns.findById(id);
        if (!run) {
            throw new AppError("Experimento no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (run.estado !== "COMPLETADA") {
            throw new AppError("El experimento debe estar completado", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const snapshot = esExperimentConfigSnapshot(run.configSnapshot) ? run.configSnapshot : null;
        if (!snapshot) {
            throw new AppError("El experimento no tiene configSnapshot", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        return snapshot;
    }

    /** GET .../experimentos/[id]/resultados — resultados paginados por caso. */
    async listarResultadosExperimento(
        id: string,
        filtros: { categoria?: string | undefined; correcto?: boolean | undefined; page: number }
    ) {
        const run = await this.evalRuns.findById(id);
        if (!run) {
            throw new AppError("Experimento no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const where: Prisma.EvalResultadoWhereInput = { experimentoId: id };
        if (filtros.categoria) where.esperado = filtros.categoria;
        if (filtros.correcto !== undefined) where.correcto = filtros.correcto;

        const [items, total] = await this.resultados.findPaginadosConTotal(where, {
            skip: (filtros.page - 1) * RESULTADOS_POR_PAGINA,
            take: RESULTADOS_POR_PAGINA,
        });

        return {
            items,
            pagination: { page: filtros.page, totalPages: Math.ceil(total / RESULTADOS_POR_PAGINA), total },
        };
    }

    /** POST /api/admin/ia/experimentos/comparar — métricas lado a lado + fronteras. */
    async compararExperimentos(ids: string[]): Promise<ResultadoComparacionExperimentos> {
        const runs = await this.evalRuns.findCompletadosPorIds(ids);

        if (runs.length !== ids.length) {
            throw new AppError("Uno o más experimentos no existen o no están completados", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const fixtureVersions = new Set(runs.map((r) => r.fixtureVersion));
        if (fixtureVersions.size > 1) {
            return { comparable: false, fixtureVersions: Array.from(fixtureVersions) };
        }

        // Fronteras: casos donde un experimento acierta y otro falla.
        const resultados = await this.resultados.findCorrectosPorExperimentos(ids);

        const byCaso = new Map<string, Record<string, boolean>>();
        for (const r of resultados) {
            if (!byCaso.has(r.casoEvalId)) byCaso.set(r.casoEvalId, {});
            byCaso.get(r.casoEvalId)![r.experimentoId] = r.correcto;
        }

        const frontier: Array<{ casoEvalId: string; resultados: Record<string, boolean> }> = [];
        for (const [casoEvalId, map] of byCaso.entries()) {
            const values = Object.values(map);
            if (values.some((v) => v) && values.some((v) => !v)) {
                frontier.push({ casoEvalId, resultados: map });
            }
        }

        return {
            comparable: true,
            fixtureVersion: runs[0].fixtureVersion,
            experimentos: runs.map(getMetrics),
            frontier: frontier.slice(0, 100),
        };
    }
}
