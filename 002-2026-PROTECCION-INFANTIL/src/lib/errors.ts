export const ERROR_CODES = {
    AUTH_INVALID: "AUTH_INVALID",
    AUTH_EXPIRED: "AUTH_EXPIRED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    // SPEC-673 (I-398): falta ≥1 modalidad en un perfil que sale de BORRADOR.
    // Código PROPIO (no VALIDATION_ERROR genérico) para que el cliente señale el
    // CAMPO (modalidad) sin tener que parsear el texto del mensaje.
    MODALIDAD_REQUERIDA: "MODALIDAD_REQUERIDA",
    CONFLICT: "CONFLICT",
    RATE_LIMITED: "RATE_LIMITED",
    // SPEC-587: fallo de un proveedor externo (OAuth de Google) — 502.
    BAD_GATEWAY: "BAD_GATEWAY",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
    // SPEC-584 (Fase 3): recurso que existió pero ya no está disponible
    // (código temporal expirado, sesión de visualización vencida).
    GONE: "GONE",
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
