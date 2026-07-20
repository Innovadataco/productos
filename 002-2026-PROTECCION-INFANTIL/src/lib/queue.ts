import { PgBoss } from "pg-boss";
import { prisma } from "./prisma";
import { getParametroSistemaValor } from "./parametros";
import { logger } from "@/lib/logger";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL requerida");

export const boss = new PgBoss(DATABASE_URL);
let started = false;

export async function ensureStarted() {
    if (!started) {
        await boss.start();
        started = true;
    }
}

export async function ensureQueue(name: string) {
    await ensureStarted();
    try {
        await boss.createQueue(name);
    } catch {
        // Cola ya existe, ignorar
    }
}

export interface WorkerParams {
    maxReintentos: number;
    retryDelaySegundos: number;
    concurrencia: number;
    maxPendientes: number;
}

export async function getWorkerParams(): Promise<WorkerParams> {
    const [maxReintentosRaw, retryDelayRaw, concurrenciaRaw, maxPendientesRaw] = await Promise.all([
        getParametroSistemaValor("worker.max_reintentos"),
        getParametroSistemaValor("worker.retry_delay_segundos"),
        getParametroSistemaValor("worker.concurrencia"),
        getParametroSistemaValor("worker.max_pendientes"),
    ]);

    return {
        maxReintentos: parseInt(maxReintentosRaw ?? "3", 10),
        retryDelaySegundos: parseInt(retryDelayRaw ?? "30", 10),
        concurrencia: parseInt(concurrenciaRaw ?? "2", 10),
        maxPendientes: parseInt(maxPendientesRaw ?? "100", 10),
    };
}

export async function getQueueStats(): Promise<{ pendientes: number }> {
    const result = (await prisma.$queryRaw`
        SELECT COUNT(*)::int as pendientes
        FROM pgboss.job
        WHERE name = 'reporte-procesamiento'
          AND state IN ('created', 'retry', 'active')
    `) as [{ pendientes: number }];
    return { pendientes: result[0]?.pendientes ?? 0 };
}

export interface SendReporteResult {
    encolado: boolean;
    jobId?: string;
}

export async function sendReporte(
    reporteId: string,
    opts?: { prioridadAlta?: boolean; intento?: number; modeloClasificacion?: string }
): Promise<SendReporteResult> {
    await ensureQueue("reporte-procesamiento");

    const { maxReintentos, retryDelaySegundos, maxPendientes } = await getWorkerParams();
    const { prioridadAlta = false } = opts ?? {};

    const stats = await getQueueStats();
    if (stats.pendientes >= maxPendientes) {
        logger.warn(`[QUEUE] Backpressure activo: ${stats.pendientes} jobs pendientes >= ${maxPendientes}. Reporte ${reporteId} no encolado.`);
        return { encolado: false };
    }

    const priority = prioridadAlta ? 10 : 1;

    const jobId = await boss.send(
        "reporte-procesamiento",
        { reporteId, intento: opts?.intento ?? 0, modeloClasificacion: opts?.modeloClasificacion },
        {
            priority,
            retryLimit: maxReintentos,
            retryDelay: retryDelaySegundos,
            retryBackoff: true,
        }
    );

    logger.info(`[QUEUE] Reporte ${reporteId} encolado con prioridad ${priority} (reintentos=${maxReintentos}, delay=${retryDelaySegundos}s)`);
    return { encolado: true, jobId: jobId ?? undefined };
}

export async function drainPending(): Promise<{ encolados: number }> {
    const { maxPendientes } = await getWorkerParams();
    const stats = await getQueueStats();
    const cupo = maxPendientes - stats.pendientes;
    if (cupo <= 0) {
        return { encolados: 0 };
    }

    const pendientes = await prisma.reporte.findMany({
        where: { estado: "PENDIENTE" },
        orderBy: [{ prioridadAlta: "desc" }, { creadoEn: "asc" }],
        take: cupo,
        select: { id: true, prioridadAlta: true },
    });

    let encolados = 0;
    for (const reporte of pendientes) {
        const result = await sendReporte(reporte.id, { prioridadAlta: reporte.prioridadAlta });
        if (result.encolado) {
            encolados++;
        }
    }

    if (encolados > 0) {
        logger.info(`[QUEUE] Drenaje: ${encolados} reportes pendientes encolados`);
    }
    return { encolados };
}

/**
 * @deprecated Use `sendReporte` instead.
 */
export async function publishReporte(reporteId: string) {
    return sendReporte(reporteId);
}

export async function publishDatasetAnonimizacionBackfill(datasetId: string) {
    await ensureQueue("dataset-anonimizacion-backfill");
    await boss.send("dataset-anonimizacion-backfill", { datasetId }, {
        retryLimit: 5,
        retryDelay: 60,
        retryBackoff: true,
    });
}

export async function publishDatasetEmbeddingBackfill(datasetId: string) {
    await ensureQueue("dataset-embedding-backfill");
    await boss.send("dataset-embedding-backfill", { datasetId }, {
        retryLimit: 5,
        retryDelay: 60,
        retryBackoff: true,
    });
}

export async function sendSimulacionRun(runId: string, modeloClasificacion: string) {
    await ensureQueue("simulacion-run");
    await boss.send("simulacion-run", { runId, modeloClasificacion }, {
        retryLimit: 3,
        retryDelay: 30,
        retryBackoff: true,
    });
}
