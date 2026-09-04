/**
 * SPEC-435 · PATCH `/api/admin/verificadores/[id]/estado` — desactivar/reactivar.
 * Molde: `admin/operadores/[id]/reactivar` + `desactivar`, unificados porque el
 * flujo del verificador no distingue casos abiertos ni cupo.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { withValidation } from "@/lib/validation";
import { verificadorIdParamsSchema, verificadorEstadoBodySchema } from "@/lib/schemas/verificador";
import { VerificadorService } from "@/lib/dal/services/verificadores";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "verificadores_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers },
            );
        }
        const { id } = withValidation.params(verificadorIdParamsSchema)(await params);
        const { estado } = await withValidation.body(verificadorEstadoBodySchema)(request);

        const verificador = await new VerificadorService().cambiarEstado(id, estado, admin.id, getClientInfo(request));
        return NextResponse.json({ verificador });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 },
        );
    }
}
