import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";
import { bandejaConsolidacionQuerySchema } from "@/lib/schemas";
import { listarBandejaConsolidacion } from "@/lib/comite/consolidacion";

/**
 * SPEC-237 (002-PI-mega-cola): bandeja de consolidaciones pendientes del
 * comité (tipo CONSOLIDACION_EXPEDIENTE), con SLA en zona Bogotá.
 * Lectura: COMITE_VALIDACION y ADMIN. PARENT: 403.
 */
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
        const parsed = bandejaConsolidacionQuerySchema.safeParse(
            Object.fromEntries(url.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const resultado = await listarBandejaConsolidacion(parsed.data);
        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[ComiteConsolidacion] Error listando bandeja:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
