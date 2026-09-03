import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { withValidation } from "@/lib/validation";
import { alertaIdParamsSchema, notaSeguimientoSchema } from "@/lib/schemas";
import { agregarNotaCaso } from "@/lib/colegio/seguimiento";

/**
 * SPEC-159 (FR-004): bitácora del caso — POST crea seguimiento (lazy, 1:1) +
 * nota + audit COLEGIO_CASO_NOTA_AGREGADA en la MISMA transacción (201). Las
 * notas son INMUTABLES por construcción: esta ruta NO exporta PATCH ni DELETE
 * (cualquier intento de edición/borrado → 404, respaldo forense Ley 1581).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        // SPEC-373 · I-251: anotar en la bitácora del caso no se bloquea por vigencia.

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { id } = withValidation.params(alertaIdParamsSchema)(await params);
        const body = await withValidation.body(notaSeguimientoSchema)(request);

        const nota = await agregarNotaCaso(user.colegioId, id, user.id, body.texto, request);

        return NextResponse.json({ nota }, { status: 201 });
    } catch (error) {
        if (error instanceof AppError && error.statusCode === 404) {
            return NextResponse.json(
                { error: { message: "Alerta no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/ALERTAS]");
    }
}
