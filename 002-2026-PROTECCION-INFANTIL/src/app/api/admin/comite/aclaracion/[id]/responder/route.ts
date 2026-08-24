import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { esComiteRol } from "@/lib/operadores/permisos";
import { responderAclaracionBodySchema } from "@/lib/schemas";
import { responderAclaracion } from "@/lib/dal/services/aclaracion-expediente";

/**
 * POST /api/admin/comite/aclaracion/[id]/responder — SPEC-238 (US2, FR-004).
 *
 * Un miembro del comité de validación responde la aclaración de un padre: la
 * aclaración pasa a RESPONDIDA y el expediente vuelve a EN_APROBACION_PADRE
 * (publica `expediente.aclaracion.respondida`). Re-responder recibe 409.
 *
 * Ámbito: el comité de plataforma responde aclaraciones de cualquier tenant
 * (el expediente de padre es cross-tenant por diseño); una cuenta de comité
 * de colegio (SPEC-168) recibe 404 (edge case de la spec).
 *
 * El payload NO incluye `respuestaTexto` (dato sensible, D-7).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "comite_bandeja");
        if (!esComiteRol(user.rol)) {
            return NextResponse.json(
                {
                    error: {
                        message: "Solo el comité de validación puede responder aclaraciones",
                        code: ERROR_CODES.FORBIDDEN,
                    },
                },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                {
                    error: {
                        message: "Demasiadas solicitudes. Espere un momento.",
                        code: ERROR_CODES.RATE_LIMITED,
                    },
                },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = await params;
        const body = responderAclaracionBodySchema.parse(await request.json());

        const aclaracion = await responderAclaracion({
            aclaracionId: id,
            comite: { id: user.id, comiteColegioId: user.comiteColegioId },
            respuestaTexto: body.respuestaTexto,
            ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
            userAgent: request.headers.get("user-agent") ?? undefined,
        });

        return NextResponse.json({
            aclaracion: {
                id: aclaracion.id,
                expedienteId: aclaracion.expedienteId,
                estado: aclaracion.estado,
                respondidaEn: aclaracion.respondidaEn,
                respondidaPor: aclaracion.respondidaPor,
            },
        });
    } catch (error) {
        return errorToResponse(error, "[COMITE/ACLARACION/RESPONDER]");
    }
}
