/**
 * SPEC-244 (002-PI-147): POST /api/colegio/suscripcion/solicitar-plan
 *
 * Un rector autenticado solicita un plan institucional. Crea una suscripción
 * PENDIENTE_AUTORIZACION que un admin autorizará manualmente (SPEC-245).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { pagosSolicitarPlanBodySchema } from "@/lib/schemas/pagos";
import { solicitarPlan } from "@/lib/pagos/suscripcion-solicitud.service";

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("SCHOOL_ADMIN");
        const rate = await checkRateLimit(request, "pagos_write", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = pagosSolicitarPlanBodySchema.parse(body);

        if (!usuario.colegioId) {
            return NextResponse.json(
                { error: { message: "El usuario no está asociado a un colegio", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const resultado = await solicitarPlan({
            usuario: {
                id: usuario.id,
                rol: usuario.rol,
                colegioId: usuario.colegioId,
                email: usuario.email,
                nombre: usuario.nombre,
            },
            planId: parsed.planId,
            codigoBono: parsed.codigoBono,
            rolDueño: usuario.rol,
        });

        return NextResponse.json(
            {
                suscripcion: {
                    id: resultado.suscripcion.id,
                    estado: resultado.suscripcion.estado,
                },
                desglose: resultado.desglose,
            },
            { status: 201 }
        );
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/SUSCRIPCION/SOLICITAR-PLAN]");
    }
}
