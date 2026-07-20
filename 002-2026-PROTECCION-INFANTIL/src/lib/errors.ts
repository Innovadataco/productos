export const ERROR_CODES = {
    AUTH_INVALID: "AUTH_INVALID",
    AUTH_EXPIRED: "AUTH_EXPIRED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    CONFLICT: "CONFLICT",
    RATE_LIMITED: "RATE_LIMITED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export class AppError extends Error {
    public readonly code: string;
    public readonly statusCode: number;

    constructor(
        message: string,
        code: string = ERROR_CODES.INTERNAL_ERROR,
        statusCode: number = 500
    ) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, AppError.prototype);
    }

    toJSON() {
        return {
            error: {
                message: this.message,
                code: this.code,
            },
        };
    }
}

/**
 * Devuelve un mensaje de error seguro para exponer al cliente.
 * Nunca expone Error.message de excepciones no controladas (puede contener
 * detalles internos, nombres de tablas, PII, etc.).
 */
export function safeErrorMessage(
    error: unknown,
    options: { fallback?: string; knownCodes?: Record<string, string> } = {}
): string {
    const { fallback = "Error interno", knownCodes = {} } = options;

    if (error instanceof AppError) {
        return error.message;
    }

    if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
        const known = knownCodes[error.code];
        if (known) return known;
    }

    return fallback;
}
