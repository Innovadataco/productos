import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { ComiteConvivenciaBandejaService } from "@/lib/dal/services/comite-convivencia-bandeja";

/**
 * SPEC-173: agregados de la bandeja del Comité de Convivencia, colegio-scoped.
 * Devuelve SOLO estadísticas (conteos por estado, tiempo medio de resolución,
 * top de categorías); nunca texto de reporte ni datos del denunciante.
 */
export async function GET(request: Request) {
    try {
        const user = await verifyAuth("COMITE_CONVIVENCIA");
        await assertModulo(user, "colegios_comite_bandeja");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        if (!user.comiteColegioId) {
            return NextResponse.json(
                { error: { message: "Cuenta del comité no vinculada a un colegio", code: ERROR_CODES.FORBIDDEN } },
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

        const estadisticas = await new ComiteConvivenciaBandejaService().estadisticas(user.comiteColegioId);

        return NextResponse.json(estadisticas);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[COLEGIO/COMITE/ESTADISTICAS]");
    }
}
