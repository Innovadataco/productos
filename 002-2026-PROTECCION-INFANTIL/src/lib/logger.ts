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

function log(level: LogLevel, message: string, ...args: unknown[]) {
    if (LEVELS[level] < currentRank) return;
    const prefix = `[${level.toUpperCase()}]`;
    const output = args.length > 0 ? [prefix, message, ...args] : [prefix, message];
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
