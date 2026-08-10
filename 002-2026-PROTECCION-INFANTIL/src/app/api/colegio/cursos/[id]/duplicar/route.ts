import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { cursoIdParamsSchema } from "@/lib/schemas";
import { duplicarCurso } from "@/lib/colegio/duplicar-curso";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * SPEC-152 — POST /api/colegio/cursos/[id]/duplicar
 * Duplica un curso propio al año siguiente de forma atómica:
 * estudiantes activos (con acudientes) + identificadores activos.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

        const { id } = withValidation.params(cursoIdParamsSchema)(await params);
        const { ipAddress, userAgent } = getClientInfo(request);

        const resultado = await duplicarCurso({
            colegioId: user.colegioId,
            cursoOrigenId: id,
            usuarioId: user.id,
            ipAddress,
            userAgent,
        });

        return NextResponse.json(resultado, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/CURSOS-DUPLICAR]");
    }
}
