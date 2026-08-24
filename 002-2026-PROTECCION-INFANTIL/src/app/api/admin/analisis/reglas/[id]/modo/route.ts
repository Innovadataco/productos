import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { ReglasAdminService } from "@/lib/dal/services/reglas-admin";
import { cambiarModoSchema } from "@/lib/schemas/analisis-reglas";

/**
 * SPEC-224 (002-PI-125, FR-009, D-77): cambio de modo de una regla — ÚNICA vía
 * (el PATCH general lo rechaza). Promoción a EJECUTA con confirmación fuerte
 * (escribir "EJECUTA") + motivo ≥ 20; reversión a RECOMIENDA con motivo ≥ 20.
 * Ambas quedan en AuditLog (REGLA_PROMOVIDA_EJECUTA / REGLA_REVERTIDA_RECOMIENDA).
 * Guards: verifyAuth(ADMIN) + módulo `analisis_admin` + rate limit.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "analisis_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = await params;
        const body = await parseBody(request, cambiarModoSchema);
        const resultado = await new ReglasAdminService().cambiarModo(id, body, {
            usuarioId: admin.id,
            ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined,
            userAgent: request.headers.get("user-agent") ?? undefined,
        });
        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/REGLAS/MODO]");
    }
}
