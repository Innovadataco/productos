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
import { actualizarFinServicioDesdePlan } from "@/lib/pagos/vigencia-colegio.service";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";

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

        // SPEC-344 (Puente D2 · R6, matiz CEO 03:18): al solicitar el plan,
        // aunque quede en PENDIENTE_AUTORIZACION, escribimos
        // `Colegio.finServicio` con la ventana según la duración del plan.
        // Sin esto un colegio nuevo se queda "gratis para siempre" al cerrar
        // el Paso 2 del camino.
        const plan = await new PagosRepository().obtenerPlanPorId(parsed.planId);
        let finServicio: Date | null = null;
        if (plan && !plan.esFreemium) {
            finServicio = await actualizarFinServicioDesdePlan(usuario.colegioId, {
                tipo: "pagado",
                duracion: plan.duracion,
            });
        }

        const res = NextResponse.json(
            {
                suscripcion: {
                    id: resultado.suscripcion.id,
                    estado: resultado.suscripcion.estado,
                },
                desglose: resultado.desglose,
                colegioFinServicio: finServicio?.toISOString() ?? null,
            },
            { status: 201 }
        );
        // Sella la cookie para cerrar el Paso 2 del camino al instante.
        await sellarCookieSesionEstado(res, usuario.id);
        return res;
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/SUSCRIPCION/SOLICITAR-PLAN]");
    }
}
