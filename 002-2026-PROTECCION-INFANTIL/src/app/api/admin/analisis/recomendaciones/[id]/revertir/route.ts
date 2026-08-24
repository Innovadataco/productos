import { NextResponse } from "next/server";
import { z } from "zod";
import { RolUsuario } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { revertirEjecucion } from "@/lib/analisis/acciones/rollback";

/**
 * SPEC-226 (002-PI-mega-cola, FR-011/FR-012): rollback manual de una acción
 * automática. Revierte la `EjecucionAccion` EJECUTADA asociada a la
 * recomendación con el efecto específico del tipo (bono desactivado,
 * notificación futura cancelada, operador desasignado, alerta atendida), la
 * marca REVERTIDA con `revertidaPorAdminId` + `motivoReversion` y registra
 * AuditLog (`ANALISIS_ACCION_REVERTIDA`).
 *
 * Guards: verifyAuth(ADMIN) + módulo `analisis_recomendaciones` + rate limit
 * `admin_write`. Códigos canónicos: 200/400/401/403/404/409/429.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
    motivo: z
        .string()
        .min(5, "El motivo de reversión es requerido")
        .max(500, "motivo no puede superar 500 caracteres"),
});

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
        const body = await parseBody(request, bodySchema);
        const resultado = await revertirEjecucion({ recomendacionId: id, motivo: body.motivo, adminId: user.id });

        return NextResponse.json({
            ejecucion: resultado.ejecucion,
            efectoReversion: resultado.efectoReversion,
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/RECOMENDACIONES/REVERTIR]");
    }
}
