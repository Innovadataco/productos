/**
 * SPEC-053 (US3, módulo IA): IaSimulacionesService.
 * Corridas de simulación sobre bancos de casos: creación, progreso, análisis,
 * resultados, exportación y comparación. Los helpers de dominio
 * (`src/lib/simulacion/*`) y la cola (`src/lib/queue.ts`) quedan fuera del DAL;
 * la ruta orquesta el encolado. Acepta tx opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { aJson } from "../json";
import {
    actualizarProgresoYEstado,
    refrescarMetricasSimulacion,
    tieneMetricasCompletas,
} from "@/lib/simulacion/progreso";
import { calcularMetricasSimulacion, canonizarCategoria } from "@/lib/simulacion/metricas";
import type { CasoSimulacion } from "@/lib/schemas/simulacion";
import { SimulacionRunRepository } from "../repositories/simulacion-run";
import { SimulacionReporteRepository } from "../repositories/simulacion-reporte";
import { ReporteRepository } from "../repositories/reporte";
import { ClasificacionIARepository } from "../repositories/clasificacion-ia";
import type {
    FilaSimulacionDto,
    ResultadoComparacionSimulacionDto,
    ResultadoSimulacionDto,
} from "../types/ia";

const SIMULACIONES_POR_PAGINA = 20;

export class IaSimulacionesService {
    private readonly simulacionRuns: SimulacionRunRepository;
    private readonly simulacionReportes: SimulacionReporteRepository;
    private readonly reportes: ReporteRepository;
    private readonly clasificaciones: ClasificacionIARepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.simulacionRuns = new SimulacionRunRepository(tx);
        this.simulacionReportes = new SimulacionReporteRepository(tx);
        this.reportes = new ReporteRepository(tx);
        this.clasificaciones = new ClasificacionIARepository(tx);
    }

    /** Guarda de corrida única (POST /simulaciones): 409 si hay una en curso. */
    async assertSinSimulacionEnCurso() {
        const enProgreso = await this.simulacionRuns.findEnProgreso();
        if (enProgreso) {
            throw new AppError(
                `Ya hay una simulación en curso (${enProgreso.id}). Espere a que termine o cancele.`,
                ERROR_CODES.CONFLICT,
                409
            );
        }
    }

    /** POST /api/admin/ia/simulaciones — una corrida PENDIENTE por modelo (el encolado lo hace la ruta). */
    async crearSimulaciones(input: {
        modelos: string[];
        casos: CasoSimulacion[];
        creadoPorId: string;
    }): Promise<{ runIds: string[]; totalCasos: number }> {
        const runIds: string[] = [];
        for (const modelo of input.modelos) {
            const run = await this.simulacionRuns.crear({
                modelo,
                totalCasos: input.casos.length,
                estado: "PENDIENTE",
                casosJson: aJson(input.casos),
                creadoPorId: input.creadoPorId,
            });
            runIds.push(run.id);
        }
        return { runIds, totalCasos: input.casos.length };
    }

    /** GET /api/admin/ia/simulaciones — listado paginado de corridas. */
    async listar(filtros: { estado?: string | undefined; page: number }) {
        const where: Prisma.SimulacionRunWhereInput = {};
        if (filtros.estado) where.estado = filtros.estado;

        const [items, total] = await this.simulacionRuns.findPaginadosConTotal(where, {
            skip: (filtros.page - 1) * SIMULACIONES_POR_PAGINA,
            take: SIMULACIONES_POR_PAGINA,
        });

        return {
            items,
            pagination: { page: filtros.page, totalPages: Math.ceil(total / SIMULACIONES_POR_PAGINA), total },
        };
    }

    /** GET .../simulaciones/[id] — refresca progreso/métricas y devuelve la corrida actualizada. */
    async obtener(id: string) {
        const run = await this.simulacionRuns.findByIdConCreador(id);
        if (!run) {
            throw new AppError("Simulación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const { estado } = await actualizarProgresoYEstado(run.id);
        if (estado === "COMPLETADA" && !tieneMetricasCompletas(run.metricasJson)) {
            await refrescarMetricasSimulacion(run.id);
        }

        return this.simulacionRuns.findByIdConCreador(run.id);
    }

    /** GET .../simulaciones/[id]/analisis — métricas calculadas al vuelo. */
    async obtenerAnalisis(id: string) {
        const run = await this.simulacionRuns.findById(id);
        if (!run) {
            throw new AppError("Simulación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const metricas = await calcularMetricasSimulacion(run.id);

        return { runId: run.id, modelo: run.modelo, metricas };
    }

    /** POST .../simulaciones/[id]/cancelar — cancela una corrida activa. */
    async cancelar(id: string) {
        const run = await this.simulacionRuns.findById(id);
        if (!run) {
            throw new AppError("Simulación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        if (!["PENDIENTE", "EN_PROGRESO"].includes(run.estado)) {
            throw new AppError(`No se puede cancelar una simulación en estado ${run.estado}`, ERROR_CODES.CONFLICT, 409);
        }

        await this.simulacionRuns.cancelar(run.id);
    }

    /** GET .../simulaciones/[id]/export — run + métricas + filas (la ruta las serializa a CSV/JSON). */
    async prepararExport(id: string) {
        const run = await this.simulacionRuns.findById(id);
        if (!run) {
            throw new AppError("Simulación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        if (run.estado === "PENDIENTE" || run.estado === "EN_PROGRESO") {
            throw new AppError(
                "La exportación solo está disponible para corridas finalizadas",
                ERROR_CODES.CONFLICT,
                409
            );
        }

        const metricas = await calcularMetricasSimulacion(run.id);

        const relacionados = await this.simulacionReportes.findPorRunOrdenados(run.id);
        const reporteIds = relacionados.map((r) => r.reporteId);
        const reportes = await this.reportes.findMinimosPorIds(reporteIds);
        const clasificaciones = await this.clasificaciones.findResumenesPorReporteIds(reporteIds);

        const reporteMap = new Map(reportes.map((r) => [r.id, r]));
        const clasifMap = new Map(clasificaciones.map((c) => [c.reporteId, c]));

        const filas: FilaSimulacionDto[] = relacionados.map((rel) => {
            const rep = reporteMap.get(rel.reporteId);
            const clasif = clasifMap.get(rel.reporteId);
            const esperado = canonizarCategoria(rel.categoriaEsperada);
            const asignado = clasif ? String(clasif.categoria) : "DESCONOCIDA";
            const acierto = rel.categoriaEsperada && esperado !== "DESCONOCIDA" ? (esperado === asignado ? "SI" : "NO") : "N/A";
            return {
                indice: rel.indice,
                identificador: rep?.identificador ?? "",
                categoriaEsperada: rel.categoriaEsperada ?? "N/A",
                categoriaAsignada: asignado,
                confianza: clasif?.confianza ?? "N/A",
                estado: rep?.estado ?? "DESCONOCIDO",
                latenciaMs: clasif?.latenciaMs ?? "N/A",
                modeloUsado: clasif?.modeloUsado ?? "N/A",
                acierto,
            };
        });

        return { run, metricas, filas };
    }

    /** GET .../simulaciones/[id]/resultados — detalle paginado por caso. */
    async listarResultados(id: string, paginacion: { page: number; pageSize: number }) {
        const run = await this.simulacionRuns.findById(id);
        if (!run) {
            throw new AppError("Simulación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const [items, total] = await this.simulacionReportes.findPaginadosConTotal(run.id, {
            skip: (paginacion.page - 1) * paginacion.pageSize,
            take: paginacion.pageSize,
        });

        const reporteIds = items.map((i) => i.reporteId);
        const [reportes, clasificaciones] = await Promise.all([
            this.reportes.findMinimosPorIds(reporteIds),
            this.clasificaciones.findResumenesPorReporteIds(reporteIds),
        ]);

        const reporteMap = new Map(reportes.map((r) => [r.id, r]));
        const clasifMap = new Map(clasificaciones.map((c) => [c.reporteId, c]));

        const resultados: ResultadoSimulacionDto[] = items.map((rel) => {
            const rep = reporteMap.get(rel.reporteId);
            const clasif = clasifMap.get(rel.reporteId);
            const esperado = canonizarCategoria(rel.categoriaEsperada);
            const asignado = clasif ? String(clasif.categoria) : "DESCONOCIDA";
            let acierto: boolean | null = null;
            if (rel.categoriaEsperada && esperado !== "DESCONOCIDA") {
                acierto = esperado === asignado;
            }

            return {
                indice: rel.indice,
                identificador: rep?.identificador ?? "",
                reporteId: rel.reporteId,
                estado: rep?.estado ?? "DESCONOCIDO",
                categoriaEsperada: rel.categoriaEsperada ?? null,
                categoriaAsignada: asignado,
                confianza: clasif?.confianza ?? null,
                latenciaMs: clasif?.latenciaMs ?? null,
                modeloUsado: clasif?.modeloUsado ?? null,
                acierto,
            };
        });

        return {
            items: resultados,
            pagination: {
                page: paginacion.page,
                totalPages: Math.ceil(total / paginacion.pageSize),
                total,
            },
        };
    }

    /** POST /api/admin/ia/simulaciones/comparar — resumen por corrida + filas por índice. */
    async comparar(ids: string[]) {
        const runs = await this.simulacionRuns.findPorIds(ids);
        if (runs.length !== ids.length) {
            throw new AppError("Una o más simulaciones no encontradas", ERROR_CODES.NOT_FOUND, 404);
        }

        const metricasRuns = await Promise.all(
            runs.map(async (run) => ({
                run,
                metricas: await calcularMetricasSimulacion(run.id),
            }))
        );

        const resultadosPorIndice: Record<number, ResultadoComparacionSimulacionDto[]> = {};

        for (const { run } of metricasRuns) {
            const relacionados = await this.simulacionReportes.findPorRunOrdenados(run.id);
            const reporteIds = relacionados.map((r) => r.reporteId);
            const reportes = await this.reportes.findMinimosPorIds(reporteIds);
            const clasificaciones = await this.clasificaciones.findBasicosPorReporteIds(reporteIds);
            const reporteMap = new Map(reportes.map((r) => [r.id, r]));
            const clasifMap = new Map(clasificaciones.map((c) => [c.reporteId, c]));

            for (const rel of relacionados) {
                const rep = reporteMap.get(rel.reporteId);
                const clasif = clasifMap.get(rel.reporteId);
                const esperado = canonizarCategoria(rel.categoriaEsperada);
                const secundaria = rel.secundariaEsperada ? canonizarCategoria(rel.secundariaEsperada) : null;
                const asignado = clasif ? String(clasif.categoria) : "DESCONOCIDA";
                const acierto =
                    rel.categoriaEsperada && esperado !== "DESCONOCIDA"
                        ? esperado === asignado || (secundaria !== null && secundaria === asignado)
                        : null;

                if (!resultadosPorIndice[rel.indice]) {
                    resultadosPorIndice[rel.indice] = [];
                }
                resultadosPorIndice[rel.indice].push({
                    runId: run.id,
                    modelo: run.modelo,
                    identificador: rep?.identificador ?? "",
                    categoriaEsperada: rel.categoriaEsperada ?? null,
                    categoriaAsignada: asignado,
                    confianza: clasif?.confianza ?? null,
                    estado: rep?.estado ?? "DESCONOCIDO",
                    acierto,
                });
            }
        }

        const indices = Object.keys(resultadosPorIndice).map(Number).sort((a, b) => a - b);
        const filas = indices.map((indice) => ({
            indice,
            resultados: resultadosPorIndice[indice],
        }));

        const resumen = metricasRuns.map(({ run, metricas }) => ({
            id: run.id,
            modelo: run.modelo,
            totalCasos: metricas.totalCasos,
            aciertos: metricas.aciertos,
            fallos: metricas.fallos,
            accuracy: metricas.accuracy,
            erroresSilenciosos: metricas.erroresSilenciosos.count,
            subestimaciones: metricas.subestimaciones.count,
            esps: metricas.esps,
            latenciaP50Ms: metricas.latenciaP50Ms,
            latenciaP95Ms: metricas.latenciaP95Ms,
            distribucionEstados: metricas.distribucionEstados,
        }));

        // Procedencia del banco (spec 085): no mezclar bancos distintos en una comparación.
        const fuentesPorRun = runs.map(
            (r) =>
                new Set(
                    ((r.casosJson ?? []) as Array<{ fuente?: string }>).map((c) => c.fuente ?? "sin-procedencia")
                )
        );
        const mezcla = fuentesPorRun.some((f) => ![...f].every((x) => fuentesPorRun[0].has(x)));

        const advertencia =
            mezcla
                ? "Las corridas usan bancos de procedencia distinta; comparar resultados entre bancos no es válido."
                : runs.some((r) => r.totalCasos !== runs[0].totalCasos)
                    ? "Las corridas tienen diferente cantidad de casos; la comparación solo incluye índices presentes en ambas."
                    : undefined;

        return {
            runs: resumen,
            filas,
            advertencia,
        };
    }
}
