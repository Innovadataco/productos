import { PgBoss } from "pg-boss";
import { prisma } from "./prisma";
import { getParametroSistemaValor } from "./parametros";
import { logger } from "./logger";

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

/**
 * SPEC-375 · Cerrar pg-boss al terminar la suite de tests.
 *
 * Sin esto: el pool y los schedulers internos de pg-boss mantienen el event
 * loop abierto → el fork de vitest no puede salir → el shard queda colgado
 * hasta el timeout general del runner (40+ min, cancelación manual). Se veía
 * en el log de CI como `Terminate orphan process: pid (…) (node (vitest 1))`.
 *
 * Es idempotente y silencioso: si `ensureStarted` nunca corrió, no hay nada
 * que apagar. Si el stop falla (por ejemplo, pool ya cerrado), no propaga.
 */
export async function disposeBoss(): Promise<void> {
    if (!started) return;
    started = false;
    try {
        await boss.stop({ graceful: false, close: true });
    } catch {
        // Silencioso: el shutdown de la suite no debe fallar el test que ya
        // pasó; y el proceso de todos modos está por terminar.
    }
}

// SPEC-375: al importar este módulo desde un test, dejamos anotado su
// disposer en un registro global — el `afterAll` de `test-setup.ts` lo
// invoca. No usamos `process.on('exit', …)` porque en workers de vitest los
// listeners de proceso a veces no se disparan antes del kill del runner.
{
    const registro = (globalThis as unknown as { __pi_test_disposers?: Set<() => Promise<void>> });
    if (!registro.__pi_test_disposers) registro.__pi_test_disposers = new Set();
    registro.__pi_test_disposers.add(disposeBoss);
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
    jobId?: string | undefined;
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

    // No re-encolar reportes que ya tienen un job en cola: sin este filtro el
    // drenaje inunda la cola con duplicados del mismo reporte (backpressure
    // permanente y procesamiento efectivo casi nulo).
    const enCola = (await prisma.$queryRaw`
        SELECT DISTINCT data->>'reporteId' AS "reporteId"
        FROM pgboss.job
        WHERE name = 'reporte-procesamiento'
          AND state IN ('created', 'retry', 'active')
    `) as { reporteId: string }[];
    const idsEnCola = enCola.map((r) => r.reporteId);

    const pendientes = await prisma.reporte.findMany({
        where: { estado: "PENDIENTE", id: { notIn: idsEnCola } },
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
 * SPEC-137 (E-5, FR-003): reconciliación del encolado. La tx de Prisma y pg-boss
 * son pools distintos (no hay outbox transaccional): si la request creó el
 * reporte pero el `sendReporte` falló (cola caída en ese instante), el reporte
 * queda PENDIENTE sin job. Esta función re-encola esos huérfanos.
 * Gracia de 1 minuto para no competir con la request en curso.
 * Devuelve conteos { encontrados, encolados, saltados }.
 */
export async function reencolarPendientesSinJob(): Promise<{ encontrados: number; encolados: number; saltados: number }> {
    const { maxPendientes } = await getWorkerParams();
    const stats = await getQueueStats();
    const cupo = maxPendientes - stats.pendientes;
    if (cupo <= 0) {
        return { encontrados: 0, encolados: 0, saltados: 0 };
    }

    // Mismo filtro anti-reencolado que drainPending: nunca duplicar un job activo.
    const enCola = (await prisma.$queryRaw`
        SELECT DISTINCT data->>'reporteId' AS "reporteId"
        FROM pgboss.job
        WHERE name = 'reporte-procesamiento'
          AND state IN ('created', 'retry', 'active')
    `) as { reporteId: string }[];
    const idsEnCola = enCola.map((r) => r.reporteId);

    const gracia = new Date(Date.now() - 60_000);
    const pendientes = await prisma.reporte.findMany({
        where: {
            estado: "PENDIENTE",
            creadoEn: { lt: gracia },
            id: { notIn: idsEnCola },
        },
        orderBy: [{ prioridadAlta: "desc" }, { creadoEn: "asc" }],
        take: cupo,
        select: { id: true, prioridadAlta: true },
    });

    let encolados = 0;
    let saltados = 0;
    for (const reporte of pendientes) {
        const result = await sendReporte(reporte.id, { prioridadAlta: reporte.prioridadAlta });
        if (result.encolado) {
            encolados++;
        } else {
            saltados++;
        }
    }

    if (encolados > 0) {
        logger.info(`[QUEUE] Reconciliación: ${encolados} reportes huérfanos re-encolados (${pendientes.length} encontrados, ${saltados} saltados por backpressure)`);
    }
    return { encontrados: pendientes.length, encolados, saltados };
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

export async function sendSimulacionLote(runIds: string[]) {
    await ensureQueue("simulacion-lote");
    await boss.send("simulacion-lote", { runIds }, {
        retryLimit: 2,
        retryDelay: 60,
        retryBackoff: true,
    });
}

/**
 * SPEC-184 (002-PI-079): encola una simulación de abuso para que el worker
 * separado `scripts/simulador-abuso.mjs` la ejecute.
 */
export async function sendSimulacionAbuso(runId: string) {
    await ensureQueue("simulacion-abuso");
    await boss.send("simulacion-abuso", { runId }, {
        retryLimit: 1,
        retryDelay: 30,
        retryBackoff: true,
    });
}

/**
 * SPEC-201: encola un job de envío en el motor de notificaciones. El worker
 * `scripts/worker-notificaciones.mjs` consume esta cola.
 */
export async function sendNotificacionEnvio(notificacionId: string, enviarEn?: Date) {
    await ensureQueue("notificacion-envio");
    const options = enviarEn ? { startAfter: enviarEn } : undefined;
    return boss.send("notificacion-envio", { notificacionId }, options) ?? undefined;
}

/**
 * SPEC-149 (FR-002): cola `colegio-aviso` — el hook de alerta nueva ENCOLA el
 * evento y responde sin bloquear; el worker consume y envía con retry. El
 * payload NO lleva datos sensibles: solo ids y el día (YYYY-MM-DD Bogotá).
 */
export interface AvisoColegioJob {
    colegioId: string;
    tipoEvento: string;
    entidadId: string;
    dia: string;
    /** SPEC-150: nota auditable del registro (p. ej. "observación especial"). */
    detalle?: string;
}

export async function sendAvisoColegio(job: AvisoColegioJob): Promise<string | undefined> {
    await ensureQueue("colegio-aviso");
    const jobId = await boss.send("colegio-aviso", job, {
        retryLimit: 5,
        retryDelay: 60,
        retryBackoff: true,
    });
    return jobId ?? undefined;
}

// ── SPEC-341 · cola del análisis IA en fila del expediente ───────────────────
// Un job por (expediente, hashCadena) — pg-boss deduplica con singletonKey.
// Prioridad ESTRICTAMENTE MENOR que la de clasificación de reportes (que sube
// a 10 con prioridadAlta) — un pico de aperturas nunca demora la clasificación.
// Backpressure propio: `padre.analisis.tope_fila` (default 50).

export type AlcanceQueue = "PADRE_COMPLETO" | "COLEGIO_BLINDADO";
export type DisparadorQueue = "APERTURA" | "ACTUALIZAR";

export interface AnalisisExpedienteJob {
    /** SPEC-350: exactamente UNO de expedienteId (padre) / seguimientoCasoId (colegio). */
    expedienteId?: string;
    seguimientoCasoId?: string;
    hashCadena: string;
    alcance: AlcanceQueue;
    disparador: DisparadorQueue;
    solicitadoEn: string; // ISO
}

export interface SendAnalisisResult {
    encolado: boolean;
    jobId?: string;
    motivo?: "cola_llena" | "duplicado";
}

/** Cuenta jobs vivos SOLO de la cola de análisis (no comparte con reportes). */
export async function getAnalisisQueueStats(): Promise<{ pendientes: number }> {
    const rows = (await prisma.$queryRaw`
        SELECT COUNT(*)::int as pendientes
        FROM pgboss.job
        WHERE name = 'padre.analisis.expediente'
          AND state IN ('created', 'retry', 'active')
    `) as [{ pendientes: number }];
    return { pendientes: rows[0]?.pendientes ?? 0 };
}

export async function sendAnalisisExpediente(job: AnalisisExpedienteJob): Promise<SendAnalisisResult> {
    await ensureQueue("padre.analisis.expediente");

    const [prioridadStr, topeStr, tiempoEstStr] = await Promise.all([
        getParametroSistemaValor("padre.analisis.prioridad"),
        getParametroSistemaValor("padre.analisis.tope_fila"),
        getParametroSistemaValor("padre.analisis.tiempo_estimado_seg"),
    ]);
    const prioridad = Number.parseInt(prioridadStr ?? "5", 10);
    const tope = Number.parseInt(topeStr ?? "50", 10);
    const expireSec = Number.parseInt(tiempoEstStr ?? "90", 10) * 3;

    // Runtime guard: nunca por encima de la clasificación (SC-008 · candado CEO).
    // La clasificación con prioridadAlta usa 10 en sendReporte; el helper del
    // análisis aborta si alguien sube el parámetro por encima de 9 por descuido.
    if (prioridad >= 10) {
        throw new Error(
            `[QUEUE] padre.analisis.prioridad=${prioridad} rompe la garantía SC-008 · debe ser < 10 (prioridad de clasificación de reportes)`
        );
    }

    const stats = await getAnalisisQueueStats();
    if (stats.pendientes >= tope) {
        logger.warn(`[QUEUE·analisis] Cola llena (${stats.pendientes}/${tope}) — dueño ${job.expedienteId ?? job.seguimientoCasoId} no encolado`);
        return { encolado: false, motivo: "cola_llena" };
    }

    // singletonKey = dueño + hash → dos aperturas seguidas del mismo
    // expediente/caso sin cambio en la cadena no encolan dos jobs.
    const dueno = job.expedienteId ?? job.seguimientoCasoId;
    if (!dueno) {
        throw new Error("[QUEUE·analisis] job sin dueño: se requiere expedienteId o seguimientoCasoId");
    }
    const singletonKey = `${dueno}:${job.hashCadena}`;

    const jobId = await boss.send("padre.analisis.expediente", job, {
        priority: prioridad,
        retryLimit: 0, // R-2: sin reintentos automáticos
        expireInSeconds: expireSec,
        singletonKey,
    });

    if (!jobId) {
        // pg-boss devolvió null → ya había un job con la misma singletonKey.
        return { encolado: false, motivo: "duplicado" };
    }

    logger.info(`[QUEUE·analisis] Encolado ${jobId} · dueño=${dueno} · prioridad=${prioridad} · disparador=${job.disparador}`);
    return { encolado: true, jobId };
}
