import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { withValidation } from "@/lib/validation";
import { cuidIdSchema } from "@/lib/schemas";
import { NotificacionUsuarioBandejaService } from "@/lib/notificaciones/bandeja-usuario";
import { z } from "zod";

const notificacionIdParamsSchema = z.object({ id: cuidIdSchema });

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = withValidation.params(notificacionIdParamsSchema)(await params);
        const afectadas = await new NotificacionUsuarioBandejaService().marcarLeida(user.id, id);
        if (afectadas === 0) {
            return NextResponse.json(
                { error: { message: "Notificación no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "NOTIFICACION_USUARIO_LEIDA",
            tipoRecurso: "Notificacion",
            recursoId: id,
            usuarioId: user.id,
            valorNuevo: JSON.stringify({ leidaEn: new Date().toISOString() }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return errorToResponse(error, "[NOTIFICACIONES/ID]");
    }
}
