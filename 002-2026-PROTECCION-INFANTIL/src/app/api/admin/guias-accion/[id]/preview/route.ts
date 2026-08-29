import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { GuiaAccionService } from "@/lib/dal/services/guia-accion";
import { guiaAccionIdParamsSchema } from "@/lib/schemas/guia-accion";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "guias_accion_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
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

        const guia = await new GuiaAccionService().preview(paramsParsed.data.id);
        return NextResponse.json({ guia });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/GUIAS-ACCION/PREVIEW]");
    }
}
