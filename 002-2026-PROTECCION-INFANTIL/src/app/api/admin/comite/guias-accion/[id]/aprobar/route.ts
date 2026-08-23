import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { GuiaAccionService } from "@/lib/dal/services/guia-accion";
import { emptyBodySchema } from "@/lib/schemas";
import { guiaAccionIdParamsSchema } from "@/lib/schemas/guia-accion";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth("COMITE_VALIDACION");
        await assertModulo(user, "comite_guias_accion");
        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const params = await context.params;
        const paramsParsed = guiaAccionIdParamsSchema.safeParse(params);
        if (!paramsParsed.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR, details: paramsParsed.error.format() } },
                { status: 400 }
            );
        }

        const body = await request.json();
        const parsed = emptyBodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "El cuerpo debe estar vacío", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const guia = await new GuiaAccionService().aprobar(paramsParsed.data.id, {
            usuarioId: user.id,
            email: user.email,
            nombre: user.nombre,
            aprobadoEn: new Date().toISOString(),
        });
        return NextResponse.json({ guia });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/COMITE/GUIAS-ACCION/APROBAR]");
    }
}
