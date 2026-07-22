import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const ESTADOS_FINALES = new Set(["CLASIFICADO", "REVISION_MANUAL", "POSIBLE_SPAM", "DUPLICADO", "CORREGIDO"]);

const TIMEOUT_PARAM_CLAVE = "ia.simulacion_timeout_minutos";
const TIMEOUT_DEFAULT_MINUTOS = 60;

export async function calcularProgresoSimulacion(runId: string): Promise<number> {
    const relacionados = await prisma.simulacionReporte.findMany({
        where: { simulacionRunId: runId },
        select: { reporteId: true },
    });
    if (relacionados.length === 0) return 0;

    const reportes = await prisma.reporte.findMany({
        where: { id: { in: relacionados.map((r) => r.reporteId) } },
        select: { estado: true },
    });

    return reportes.filter((r) => ESTADOS_FINALES.has(r.estado)).length;
}

async function obtenerTimeoutMinutos(): Promise<number> {
    try {
        const param = await prisma.parametroSistema.findUnique({ where: { clave: TIMEOUT_PARAM_CLAVE } });
        const valor = param ? Number(param.valor) : NaN;
        return Number.isFinite(valor) && valor > 0 ? valor : TIMEOUT_DEFAULT_MINUTOS;
    } catch (err) {
        logger.warn(`[SIMULACION] No se pudo leer ${TIMEOUT_PARAM_CLAVE}; usando default ${TIMEOUT_DEFAULT_MINUTOS}.`);
        return TIMEOUT_DEFAULT_MINUTOS;
    }
}

function leerCasosFallidos(metricasJson: unknown): number {
    if (!metricasJson || typeof metricasJson !== "object") return 0;
    const valor = (metricasJson as Record<string, unknown>).casosFallidos;
    const num = Number(valor);
    return Number.isFinite(num) && num > 0 ? num : 0;
}

export function tieneMetricasCompletas(metricasJson: unknown): boolean {
    if (!metricasJson || typeof metricasJson !== "object") return false;
    return typeof (metricasJson as Record<string, unknown>).accuracy === "number";
}

export async function actualizarProgresoYEstado(runId: string): Promise<{ progreso: number; estado: string }> {
    const run = await prisma.simulacionRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error(`Run ${runId} no encontrado`);
    if (["COMPLETADA", "FALLIDA", "CANCELADA"].includes(run.estado)) {
        return { progreso: run.progreso, estado: run.estado };
    }

    const progreso = await calcularProgresoSimulacion(runId);
    const casosFallidos = leerCasosFallidos(run.metricasJson);
    // Los casos que nunca se encolaron no se clasificarán: no bloquean el cierre.
    const totalEfectivo = Math.max(0, run.totalCasos - casosFallidos);

    let estado = run.estado;
    if (run.estado === "EN_PROGRESO") {
        if (totalEfectivo > 0 && progreso >= totalEfectivo) {
            estado = "COMPLETADA";
        } else {
            const timeoutMinutos = await obtenerTimeoutMinutos();
            const limite = new Date(run.fechaInicio.getTime() + timeoutMinutos * 60_000);
            if (new Date() > limite) {
                estado = "FALLIDA";
                logger.warn(
                    `[SIMULACION] Run ${runId} superó el timeout de ${timeoutMinutos} min (${progreso}/${totalEfectivo}); marcada FALLIDA.`
                );
            }
        }
    }

    const cierra = estado === "COMPLETADA" || estado === "FALLIDA";
    if (estado !== run.estado || progreso !== run.progreso) {
        await prisma.simulacionRun.update({
            where: { id: runId },
            data: {
                progreso,
                estado,
                fechaFin: cierra ? new Date() : run.fechaFin,
            },
        });
    }

    if (estado === "COMPLETADA") {
        await refrescarMetricasSimulacion(runId);
    }

    return { progreso, estado };
}

export async function refrescarMetricasSimulacion(runId: string): Promise<void> {
    const run = await prisma.simulacionRun.findUnique({ where: { id: runId } });
    if (!run || run.estado !== "COMPLETADA") return;

    try {
        const { calcularMetricasSimulacion } = await import("./metricas");
        const metricas = await calcularMetricasSimulacion(runId);
        const actuales = (run.metricasJson ?? {}) as Record<string, unknown>;
        await prisma.simulacionRun.update({
            where: { id: runId },
            data: {
                metricasJson: { ...metricas, casosFallidos: leerCasosFallidos(actuales) } as never,
            },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[SIMULACION] Error refrescando métricas run ${runId}: ${msg}`);
    }
}

/**
 * Hook fail-open llamado desde POST /api/reportes/procesar: si el reporte
 * pertenece a una simulación, actualiza el progreso (y posible cierre) del run.
 * Nunca propaga errores: la clasificación del reporte no depende de esto.
 */
export async function marcarProgresoSimulacionPorReporte(reporteId: string): Promise<void> {
    try {
        const vinculo = await prisma.simulacionReporte.findUnique({ where: { reporteId } });
        if (!vinculo) return;
        await actualizarProgresoYEstado(vinculo.simulacionRunId);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[SIMULACION] Error en hook de progreso para reporte ${reporteId}: ${msg}`);
    }
}

export { ESTADOS_FINALES };
