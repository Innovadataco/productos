import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { reasignarReporte } from "@/lib/operadores/reasignar-service";
import { reasignarOperadorBodySchema } from "@/lib/schemas";

/**
 * PATCH /api/admin/operadores/reasignar (SPEC-193 Fase 2)
 * Reasigna un reporte en revisión manual de un operador a otro.
 */
export async function PATCH(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "operadores");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = reasignarOperadorBodySchema.parse(body);

        const resultado = await reasignarReporte({
            reporteId: parsed.reporteId,
            operadorDestinoId: parsed.operadorDestinoId,
            motivo: parsed.motivo,
            adminId: admin.id,
            request,
        });

        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/OPERADORES/REASIGNAR]");
    }
}
