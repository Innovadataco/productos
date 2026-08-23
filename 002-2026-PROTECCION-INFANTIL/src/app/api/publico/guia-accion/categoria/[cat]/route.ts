import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { GuiaAccionService } from "@/lib/dal/services/guia-accion";
import { categoriaGuiaPublicaParamsSchema } from "@/lib/schemas/guia-accion";

interface RouteContext {
    params: Promise<{ cat: string }>;
}

export async function GET(request: Request, context: RouteContext) {
    try {
        const rate = await checkRateLimit(request, "guias_accion_publica", {
            identifier: getClientIp(request),
        });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const params = await context.params;
        const paramsParsed = categoriaGuiaPublicaParamsSchema.safeParse(params);
        if (!paramsParsed.success) {
            return NextResponse.json(
                { error: { message: "Categoría inválida", code: ERROR_CODES.VALIDATION_ERROR, details: paramsParsed.error.format() } },
                { status: 400 }
            );
        }

        const guia = await new GuiaAccionService().consultaPublica(paramsParsed.data.cat);
        if (!guia) {
            return NextResponse.json(
                { error: { message: "Guía no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json({ guia }, { headers: rate.headers });
    } catch (error) {
        return errorToResponse(error, "[PUBLICO/GUIA-ACCION]");
    }
}
