/**
 * Sobre de error único para API Routes (R2, spec 121).
 *
 * Centraliza la conversión error → respuesta HTTP que antes estaba duplicada
 * en ~27 bloques catch con una rama defectuosa: cualquier Error con propiedad
 * `code` string (Prisma P2002, errores de red, etc.) colapsaba a HTTP 403 y
 * filtraba el código interno al cliente.
 *
 * Contrato:
 * - AppError (incl. ValidationError) → su statusCode y su toJSON().
 * - ZodError crudo → 400 VALIDATION_ERROR con detalles { message, path }.
 * - Cualquier otro error → 500 INTERNAL_ERROR genérico ("Error interno"),
 *   sin exponer error.message ni error.code; el detalle queda en el log.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, ERROR_CODES } from "./errors";
import { formatZodError } from "./validation";

type RouteHandler = (request: Request, context?: unknown) => Promise<Response>;

/**
 * Convierte un error atrapado en una API Route a su respuesta HTTP.
 * `modulo` etiqueta el log servidor con el formato `[Módulo] ...`.
 */
export function errorToResponse(error: unknown, modulo = "[API]"): NextResponse {
    if (error instanceof AppError) {
        return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }

    if (error instanceof ZodError) {
        return NextResponse.json(
            {
                error: {
                    message: "Datos inválidos",
                    code: ERROR_CODES.VALIDATION_ERROR,
                    details: formatZodError(error),
                },
            },
            { status: 400 }
        );
    }

    const detalle = error instanceof Error ? error.message : String(error);
    console.error(`${modulo} Error no controlado: ${detalle}`);
    return NextResponse.json(
        { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
        { status: 500 }
    );
}

/**
 * Envuelve un handler de API Route para que cualquier error lanzado salga por
 * `errorToResponse`. Alternativa al try/catch manual por ruta.
 */
export function withErrorHandler(handler: RouteHandler, modulo = "[API]"): RouteHandler {
    return async (request, context) => {
        try {
            return await handler(request, context);
        } catch (error) {
            return errorToResponse(error, modulo);
        }
    };
}
