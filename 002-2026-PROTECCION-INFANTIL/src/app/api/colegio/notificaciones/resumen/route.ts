import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { NotificacionInAppRepository } from "@/lib/dal/repositories/notificacion-in-app";

async function verificarAccesoColegio(request: Request) {
    const user = await verifyAuth("SCHOOL_ADMIN");
    await assertModulo(user, "colegios_notificaciones");
    const vigencia = await verificarVigenciaColegio(user.id);
    if (!vigencia.vigente) {
        return { error: NextResponse.json({ error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } }, { status: 403 }) };
    }

    const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
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

export async function GET(request: Request) {
    try {
        const acceso = await verificarAccesoColegio(request);
        if ("error" in acceso) return acceso.error;

        const count = await new NotificacionInAppRepository().contarNoLeidas(acceso.colegioId, acceso.user.id);
        return NextResponse.json({ noLeidas: count });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/NOTIFICACIONES/RESUMEN]");
    }
}
