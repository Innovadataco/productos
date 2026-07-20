import { z, type ZodSchema, type ZodError } from "zod";
import { AppError, ERROR_CODES } from "./errors";

export type ValidationErrorDetail = {
    message: string;
    path: string;
};

function formatZodError(error: ZodError): ValidationErrorDetail[] {
    return error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.join("."),
    }));
}

export class ValidationError extends AppError {
    public readonly details: ValidationErrorDetail[];

    constructor(message: string, details: ValidationErrorDetail[]) {
        super(message, ERROR_CODES.VALIDATION_ERROR, 400);
        this.details = details;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }

    toJSON() {
        return {
            error: {
                message: this.message,
                code: this.code,
                details: this.details,
            },
        };
    }
}

export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
    const body = await request.json().catch(() => undefined);
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError("Datos inválidos", formatZodError(result.error));
    }
    return result.data;
}

export function parseParams<T>(params: unknown, schema: ZodSchema<T>): T {
    const result = schema.safeParse(params);
    if (!result.success) {
        throw new ValidationError("Parámetros de ruta inválidos", formatZodError(result.error));
    }
    return result.data;
}

export const withValidation = {
    body: <T>(schema: ZodSchema<T>) => {
        return async (request: Request): Promise<T> => parseBody(request, schema);
    },
    params: <T>(schema: ZodSchema<T>) => {
        return (params: unknown): T => parseParams(params, schema);
    },
};
