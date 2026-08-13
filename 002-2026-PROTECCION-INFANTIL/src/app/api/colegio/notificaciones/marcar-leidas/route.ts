import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { NotificacionInAppRepository } from "@/lib/dal/repositories/notificacion-in-app";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

async function verificarAccesoColegio(request: Request) {
    const user = await verifyAuth("SCHOOL_ADMIN");
    await assertModulo(user, "colegios_notificaciones");
    const vigencia = await verificarVigenciaColegio(user.id);
    if (!vigencia.vigente) {
        return { error: NextResponse.json({ error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } }, { status: 403 }) };
    }

    const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
    if (!rate.allowed) {
        return {
            error: NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            ),
        };
    }

    if (!user.colegioId) {
        return { error: NextResponse.json({ error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } }, { status: 403 }) };
    }

    return { user, colegioId: user.colegioId };
}

export async function PATCH(request: Request) {
    try {
        const acceso = await verificarAccesoColegio(request);
        if ("error" in acceso) return acceso.error;

        const repo = new NotificacionInAppRepository();
        const afectadas = await repo.marcarTodasLeidas(acceso.colegioId, acceso.user.id);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_NOTIFICACION_LEIDA",
            tipoRecurso: "NotificacionInApp",
            usuarioId: acceso.user.id,
            colegioId: acceso.colegioId,
            valorNuevo: JSON.stringify({ marcarTodas: true, afectadas }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ afectadas });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/NOTIFICACIONES/MARCAR-LEIDAS]");
    }
}
