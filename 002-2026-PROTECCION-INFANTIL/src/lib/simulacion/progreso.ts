import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const ESTADOS_FINALES = new Set(["CLASIFICADO", "REVISION_MANUAL", "POSIBLE_SPAM", "DUPLICADO", "CORREGIDO"]);

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

export async function actualizarProgresoYEstado(runId: string): Promise<{ progreso: number; estado: string }> {
    const run = await prisma.simulacionRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error(`Run ${runId} no encontrado`);
    if (["COMPLETADA", "FALLIDA", "CANCELADA"].includes(run.estado)) {
        return { progreso: run.progreso, estado: run.estado };
    }

    const progreso = await calcularProgresoSimulacion(runId);
    const total = run.totalCasos;

    let estado = run.estado;
    if (run.estado === "EN_PROGRESO" && progreso >= total && total > 0) {
        estado = "COMPLETADA";
    }

    if (estado !== run.estado || progreso !== run.progreso) {
        await prisma.simulacionRun.update({
            where: { id: runId },
            data: {
                progreso,
                estado,
                fechaFin: estado === "COMPLETADA" ? new Date() : run.fechaFin,
            },
        });
    }

    return { progreso, estado };
}

export async function refrescarMetricasSimulacion(runId: string): Promise<void> {
    const run = await prisma.simulacionRun.findUnique({ where: { id: runId } });
    if (!run || run.estado !== "COMPLETADA") return;

    try {
        const { calcularMetricasSimulacion } = await import("./metricas");
        const metricas = await calcularMetricasSimulacion(runId);
        await prisma.simulacionRun.update({
            where: { id: runId },
            data: { metricasJson: metricas as never },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[SIMULACION] Error refrescando métricas run ${runId}: ${msg}`);
    }
}

export { ESTADOS_FINALES };
