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