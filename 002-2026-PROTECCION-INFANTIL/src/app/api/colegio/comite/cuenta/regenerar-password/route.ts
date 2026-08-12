import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { ComiteConvivenciaService } from "@/lib/dal/services/comite-convivencia";
import type { InfoClienteDto } from "@/lib/dal/services/comite-convivencia";

function getClientInfo(request: Request): InfoClienteDto {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_comite");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const resultado = await new ComiteConvivenciaService().regenerarPassword(
            user.colegioId,
            user.id,
            getClientInfo(request)
        );

        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[COLEGIO/COMITE/CUENTA/REGENERAR-PASSWORD]");
    }
}
