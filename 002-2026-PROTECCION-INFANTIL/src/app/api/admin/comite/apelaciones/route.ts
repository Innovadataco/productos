import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";
import { ComiteApelacionesService } from "@/lib/dal/services/comite-apelaciones";

/**
 * SPEC-110 — Bandeja propia de apelaciones del comité de validación.
 *
 * Lista los casos con estado, fechas, días hábiles transcurridos y la marca de
 * "próximo a vencer" (≥ apelacion.aviso_previo_dias días hábiles sin resolver).
 * Reutiliza los patrones de la bandeja existente (assertModulo comite_bandeja,
 * paginación page/pageSize).
 */

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    estado: z.enum(["RECIBIDA", "EN_REVISION", "ACEPTADA", "RECHAZADA"]).optional(),
});

export async function GET(request: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "comite_bandeja");
        if (!esAdminRol(user.rol) && !esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { page, pageSize, estado } = parsedQuery.data;

        // SPEC-053: bandeja, días hábiles y marca "próximo a vencer" viven en el DAL.
        const resultado = await new ComiteApelacionesService().listarBandeja({ estado, page, pageSize });

        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("[ComiteApelaciones] Error listando bandeja:", msg);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
