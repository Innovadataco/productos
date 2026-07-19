import { prisma } from "./prisma";
import { logger } from "@/lib/logger";

const QUEUE_NAME = "reporte-procesamiento";

type JobStateRow = {
    state: string;
    count: bigint;
    avgLatenciaMs: number | null;
};

export interface WorkerMetrics {
    conteosPorEstado: Record<string, number>;
    enCola: number;
    activos: number;
    estancados: number;
    completados: number;
    fallidos: number;
    latenciaPromedioMs: number;
    tasaExito: number;
    totalJobs: number;
}

export async function getWorkerMetrics(): Promise<WorkerMetrics | null> {
    try {
        const rows = await prisma.$queryRaw<JobStateRow[]>`
            SELECT
                state,
                COUNT(*)::int AS count,
                AVG(
                    CASE
                        WHEN state IN ('completed', 'failed')
                            AND started_on IS NOT NULL
                            AND completed_on IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (completed_on - started_on)) * 1000
                    END
                )::float AS "avgLatenciaMs"
            FROM pgboss.job
            WHERE name = ${QUEUE_NAME}
            GROUP BY state
        `;

        const stalledRow = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*)::int AS count
            FROM pgboss.job
            WHERE name = ${QUEUE_NAME}
              AND state = 'active'
              AND started_on + (expire_seconds || ' seconds')::interval < NOW()
        `;

        const conteosPorEstado: Record<string, number> = {};
        let totalJobs = 0;
        let completados = 0;
        let fallidos = 0;
        let activos = 0;
        let latenciaTotal = 0;
        let latenciaCount = 0;

        for (const row of rows) {
            const count = Number(row.count);
            conteosPorEstado[row.state] = count;
            totalJobs += count;

            if (row.state === "completed") completados = count;
            if (row.state === "failed") fallidos = count;
            if (row.state === "active") activos = count;

            if (row.avgLatenciaMs != null) {
                latenciaTotal += row.avgLatenciaMs * count;
                latenciaCount += count;
            }
        }

        const enCola = totalJobs - completados - fallidos - (conteosPorEstado.cancelled || 0);
        const estancados = Number(stalledRow[0]?.count || 0);
        const latenciaPromedioMs = latenciaCount > 0 ? Math.round(latenciaTotal / latenciaCount) : 0;
        const terminados = completados + fallidos;
        const tasaExito = terminados > 0 ? Math.round((completados / terminados) * 1000) / 10 : 0;

        return {
            conteosPorEstado,
            enCola,
            activos,
            estancados,
            completados,
            fallidos,
            latenciaPromedioMs,
            tasaExito,
            totalJobs,
        };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("[QUEUE-METRICS] Error obteniendo métricas del worker:", msg);
        return null;
    }
}
