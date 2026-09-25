import { logger } from "../logger.ts";
import { prisma } from "../prisma.ts";
import { getParametroSistemaValor } from "../parametros.ts";
import { NivelLog } from "@prisma/client";

const NIVELES_ORDEN: Record<NivelLog, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

const NIVELES_VALIDOS: readonly NivelLog[] = ["DEBUG", "INFO", "WARN", "ERROR"];

/** TTL del cache de configuración de logs en ms (ZEUS: releer cada N segundos). */
const CONFIG_TTL_MS = 30_000;

type ConfigCache = {
    enabled: boolean;
    minimo: NivelLog;
    leidoEn: number;
};

let configCache: ConfigCache | null = null;

export type ContextoWorkerLog = Record<string, unknown> | undefined;

export interface WorkerLogger {
    debug(mensaje: string, contextoJson?: ContextoWorkerLog): Promise<void>;
    info(mensaje: string, contextoJson?: ContextoWorkerLog): Promise<void>;
    warn(mensaje: string, contextoJson?: ContextoWorkerLog): Promise<void>;
    error(mensaje: string, contextoJson?: ContextoWorkerLog): Promise<void>;
    child(defaults: { servicio: string }): WorkerLogger;
}

function nivelEsValido(valor: string): valor is NivelLog {
    return (NIVELES_VALIDOS as readonly string[]).includes(valor);
}

function parseNivelMinimo(raw: string | null): NivelLog {
    if (raw && nivelEsValido(raw)) return raw;
    logger.warn("[WorkerLogger] Nivel mínimo inválido, usando WARN", { raw });
    return "WARN";
}

function cumpleNivelMinimo(nivel: NivelLog, minimo: NivelLog): boolean {
    return NIVELES_ORDEN[nivel] >= NIVELES_ORDEN[minimo];
}

async function leerConfig(): Promise<{ enabled: boolean; minimo: NivelLog }> {
    const ahora = Date.now();
    if (configCache && ahora - configCache.leidoEn < CONFIG_TTL_MS) {
        return { enabled: configCache.enabled, minimo: configCache.minimo };
    }

    const enabledRaw = await getParametroSistemaValor("monitoreo.logs.enabled");
    const enabled = enabledRaw === "true";
    const minimoRaw = await getParametroSistemaValor("monitoreo.logs.nivel_minimo");
    const minimo = parseNivelMinimo(minimoRaw);

    configCache = { enabled, minimo, leidoEn: ahora };
    return { enabled, minimo };
}

/** Expone invalidación del cache para tests. */
export function _invalidateWorkerLoggerCache(): void {
    configCache = null;
}

async function debePersistir(nivel: NivelLog): Promise<boolean> {
    const { enabled, minimo } = await leerConfig();
    if (!enabled) return false;
    return cumpleNivelMinimo(nivel, minimo);
}

/** El límite de la columna `WorkerLog.mensaje` (VarChar(500)). */
const MENSAJE_MAX = 500;

/**
 * SPEC-737: un `mensaje` más largo que la columna hace fallar el INSERT
 * («value too long for type character varying(500)») y perdíamos el log. Se
 * trunca a 500 (con marcador) para que un mensaje largo NUNCA tumbe la escritura.
 */
function truncarMensaje(mensaje: string): string {
    return mensaje.length > MENSAJE_MAX ? `${mensaje.slice(0, MENSAJE_MAX - 1)}…` : mensaje;
}

async function persistir(
    servicio: string,
    nivel: NivelLog,
    mensaje: string,
    contextoJson?: ContextoWorkerLog,
    esRastroDeFallo = false
): Promise<void> {
    try {
        await prisma.workerLog.create({
            data: {
                servicio,
                nivel,
                mensaje: truncarMensaje(mensaje),
                ...(contextoJson ? { contextoJson: contextoJson as never } : {}),
            },
        });
    } catch (error) {
        const detalle = error instanceof Error ? error.message : String(error);
        logger.error(`[WorkerLogger] Fallo al persistir log: ${detalle}`, { servicio, nivel });
        // SPEC-737: un worker «vivo» sin log es peor que nada. Si el INSERT falla,
        // dejamos RASTRO en el propio `workerLog` (un renglón ERROR mínimo y seguro:
        // sin `contextoJson`, con el mensaje truncado), para que el tab de operación
        // no se apague en silencio. Un solo intento, y JAMÁS desde el propio rastro
        // (`esRastroDeFallo`) → si la BD está caída no hay recursión infinita, cae al
        // `logger.error` de arriba (stdout del contenedor).
        if (!esRastroDeFallo) {
            await persistir(
                servicio,
                "ERROR",
                `WorkerLogger: no se pudo persistir un log (${servicio}/${nivel}): ${detalle}`,
                undefined,
                true
            );
        }
    }
}

function escribirStdout(
    servicio: string,
    nivel: NivelLog,
    mensaje: string,
    contextoJson?: ContextoWorkerLog
): void {
    const prefixed = `[${servicio}] ${mensaje}`;
    if (contextoJson) {
        switch (nivel) {
            case "DEBUG":
                logger.debug(prefixed, contextoJson);
                break;
            case "INFO":
                logger.info(prefixed, contextoJson);
                break;
            case "WARN":
                logger.warn(prefixed, contextoJson);
                break;
            case "ERROR":
                logger.error(prefixed, contextoJson);
                break;
        }
    } else {
        switch (nivel) {
            case "DEBUG":
                logger.debug(prefixed);
                break;
            case "INFO":
                logger.info(prefixed);
                break;
            case "WARN":
                logger.warn(prefixed);
                break;
            case "ERROR":
                logger.error(prefixed);
                break;
        }
    }
}

async function log(
    servicio: string,
    nivel: NivelLog,
    mensaje: string,
    contextoJson?: ContextoWorkerLog
): Promise<void> {
    escribirStdout(servicio, nivel, mensaje, contextoJson);
    const persistirEnabled = await debePersistir(nivel);
    if (persistirEnabled) {
        await persistir(servicio, nivel, mensaje, contextoJson);
    }
}

function crearLogger(defaults: { servicio: string }): WorkerLogger {
    const servicio = defaults.servicio;
    return {
        debug: (mensaje: string, contextoJson?: ContextoWorkerLog) =>
            log(servicio, "DEBUG", mensaje, contextoJson),
        info: (mensaje: string, contextoJson?: ContextoWorkerLog) =>
            log(servicio, "INFO", mensaje, contextoJson),
        warn: (mensaje: string, contextoJson?: ContextoWorkerLog) =>
            log(servicio, "WARN", mensaje, contextoJson),
        error: (mensaje: string, contextoJson?: ContextoWorkerLog) =>
            log(servicio, "ERROR", mensaje, contextoJson),
        child: (childDefaults: { servicio: string }) => crearLogger(childDefaults),
    };
}

export const workerLogger: WorkerLogger = {
    ...crearLogger({ servicio: "worker" }),
    child: crearLogger,
};
