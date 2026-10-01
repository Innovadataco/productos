import { safeErrorMessage } from "./errors";

const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
} as const;

type LogLevel = keyof typeof LEVELS;

function getLogLevel(): LogLevel {
    const env = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
    if (env && env in LEVELS) return env;
    return process.env.NODE_ENV === "production" ? "warn" : "info";
}

const currentLevel = getLogLevel();
const currentRank = LEVELS[currentLevel];

// SPEC-815: profundidad acotada para no recorrer estructuras cíclicas ni grandes al sanitizar.
const PROFUNDIDAD_MAX = 3;

function esObjetoPlano(valor: object): boolean {
    const proto = Object.getPrototypeOf(valor);
    return proto === Object.prototype || proto === null;
}

/**
 * SPEC-815 · Un Error crudo NO puede llegar a un log: su `message`/`stack` puede traer datos internos
 * o PII (p. ej. el correo que un proveedor eco de vuelta, o el valor de un identificador en el error
 * de una consulta). Se reemplaza por `safeErrorMessage` —el mismo serializador seguro que ya usa el
 * resto del sistema (errors.ts)—, tanto si viene como argumento suelto como anidado en un objeto o
 * arreglo plano. Es imposibilidad estructural: el chokepoint es el logger, no cada sitio de llamada.
 * No toca objetos no-planos (Date, Map, etc.) salvo que sean Error.
 */
function sanitizarArg(valor: unknown, profundidad = 0): unknown {
    if (valor instanceof Error) return safeErrorMessage(valor);
    if (valor === null || typeof valor !== "object" || profundidad >= PROFUNDIDAD_MAX) return valor;
    if (Array.isArray(valor)) return valor.map((v) => sanitizarArg(v, profundidad + 1));
    if (!esObjetoPlano(valor)) return valor;
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
        salida[clave] = sanitizarArg(v, profundidad + 1);
    }
    return salida;
}

function log(level: LogLevel, message: string, ...args: unknown[]) {
    if (LEVELS[level] < currentRank) return;
    const prefix = `[${level.toUpperCase()}]`;
    const limpios = args.map((a) => sanitizarArg(a));
    const output = limpios.length > 0 ? [prefix, message, ...limpios] : [prefix, message];
    if (level === "error") {
        console.error(...output);
    } else if (level === "warn") {
        console.warn(...output);
    } else {
        console.log(...output);
    }
}

export const logger = {
    debug: (message: string, ...args: unknown[]) => log("debug", message, ...args),
    info: (message: string, ...args: unknown[]) => log("info", message, ...args),
    warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
    error: (message: string, ...args: unknown[]) => log("error", message, ...args),
};

export type { LogLevel };
export { LEVELS };
