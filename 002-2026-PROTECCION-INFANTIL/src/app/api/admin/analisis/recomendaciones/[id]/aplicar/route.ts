import { NextResponse } from "next/server";
import { RolUsuario } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { aplicarRecomendacion } from "@/lib/analisis/acciones/aplicar";

/**
 * SPEC-226 (002-PI-mega-cola, FR-010/FR-012): aplicación manual de una
 * sugerencia PENDIENTE. Ejecuta la acción por el mismo ejecutor de las reglas
 * EJECUTA (misma trazabilidad en `EjecucionAccion` + AuditLog y mismo
 * rate-limit por regla) con origen MANUAL_ADMIN y la marca APLICADA con
 * `resueltaPorAdminId`. Si la recomendación no tiene acción ejecutable, queda
 * APLICADA y la respuesta trae `ejecucion: null`.
 *
 * Guards: verifyAuth(ADMIN) + módulo `analisis_recomendaciones` + rate limit
 * `admin_write`. Códigos canónicos: 200/401/403/404/409/429.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "analisis_recomendaciones");

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = await params;
        const resultado = await aplicarRecomendacion({ id, adminId: user.id });

        return NextResponse.json({
            recomendacion: {
                id: resultado.recomendacion.id,
                estado: resultado.recomendacion.estado,
                ejecutadaAutomatica: resultado.recomendacion.ejecutadaAutomatica,
            },
            ejecucion: resultado.ejecucion,
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/RECOMENDACIONES/APLICAR]");
    }
}
