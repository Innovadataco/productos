import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { alertaIdParamsSchema } from "@/lib/schemas";
import { obtenerDetalleCaso } from "@/lib/colegio/seguimiento";

/**
 * SPEC-159 (FR-002): detalle del caso del colegio en UNA llamada (alerta +
 * timeline derivada + pendientes + seguimiento con notas). 404 si la alerta no
 * existe o es de OTRO colegio (tenant-first): ningún dato cruza.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
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

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { id } = withValidation.params(alertaIdParamsSchema)(await params);
        const caso = await obtenerDetalleCaso(user.colegioId, id);

        return NextResponse.json({ caso });
    } catch (error) {
        if (error instanceof AppError && error.statusCode === 404) {
            return NextResponse.json(
                { error: { message: "Alerta no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/ALERTAS]");
    }
}
