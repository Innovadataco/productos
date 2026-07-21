export const ERROR_CODES = {
  AUTH_INVALID: "AUTH_INVALID",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  LOCKED: "LOCKED",
  RATE_LIMITED: "RATE_LIMITED",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  INTEGRATION_DISABLED: "INTEGRATION_DISABLED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;

  constructor(message: string, code: ErrorCode, statusCode: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }

  toJSON() {
    return { error: this.message, code: this.code };
  }
}

/// Nunca expone detalles internos al cliente.
export function safeErrorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  return "Error interno del servidor";
}
