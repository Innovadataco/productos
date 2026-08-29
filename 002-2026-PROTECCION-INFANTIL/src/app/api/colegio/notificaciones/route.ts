import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { notificacionFiltroSchema } from "@/lib/schemas";
import { NotificacionInAppRepository } from "@/lib/dal/repositories/notificacion-in-app";

async function verificarAccesoColegio(request: Request, scope: "admin_read" | "admin_write") {
    const user = await verifyAuth("SCHOOL_ADMIN");
    await assertModulo(user, "colegios_notificaciones");
    const vigencia = await verificarVigenciaColegio(user.id);
    if (!vigencia.vigente) {
        return { error: NextResponse.json({ error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } }, { status: 403 }) };
    }

    const rate = await checkRateLimit(request, scope, { identifier: user.id });
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
        const acceso = await verificarAccesoColegio(request, "admin_read");
        if ("error" in acceso) return acceso.error;

        const { searchParams } = new URL(request.url);
        const filtros = withValidation.params(notificacionFiltroSchema)({
            page: searchParams.get("page") ?? undefined,
            pageSize: searchParams.get("pageSize") ?? undefined,
            soloNoLeidas: searchParams.get("soloNoLeidas") ?? undefined,
        });

        const repo = new NotificacionInAppRepository();
        const resultado = await repo.listar(acceso.colegioId, acceso.user.id, filtros);
        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/NOTIFICACIONES]");
    }
}
