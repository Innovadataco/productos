import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { activarEmergencia } from "@/lib/expediente/activar-emergencia";

/**
 * POST /api/admin/comite/expediente/[id]/activar-emergencia — SPEC-239 (FR-005).
 *
 * Solo COMITE_VALIDACION (FR-005; ADMIN/PARENT → 403). Activa la emergencia de
 * un expediente ROJO: selecciona el contacto de emergencia activo de menor
 * prioridad del padre, publica `expediente.emergencia.activada` en Motor Notif
 * y audita EXPEDIENTE_EMERGENCIA_ACTIVADA.
 *
 * Respuestas: 200 éxito; 202 éxito con advertencia (notificación no programada,
 * best-effort); 404 expediente; 409 no ROJO / sin contactos / doble activación.
 */
interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth();
        if (user.rol !== "COMITE_VALIDACION") {
            throw new AppError(
                "Solo el comité de validación puede activar una emergencia",
                ERROR_CODES.FORBIDDEN,
                403
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = await context.params;
        const resultado = await activarEmergencia(id, {
            activadorId: user.id,
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
            userAgent: request.headers.get("user-agent") || "unknown",
        });

        const body = {
            expediente: {
                id: resultado.expediente.id,
                scoreGravedadActual: resultado.expediente.scoreGravedadActual,
                estado: resultado.expediente.estado,
                slaEfectivoHoras: resultado.expediente.slaEfectivoHoras,
            },
            contacto: {
                id: resultado.contacto.id,
                nombre: resultado.contacto.nombre,
                relacion: resultado.contacto.relacion,
                telefono: resultado.contacto.telefono,
                email: resultado.contacto.email,
                prioridad: resultado.contacto.prioridad,
            },
            notificacionProgramada: resultado.notificacionProgramada,
            eventoPublicado: resultado.eventoPublicado,
            ...(resultado.advertencia ? { advertencia: resultado.advertencia } : {}),
        };

        return NextResponse.json(body, { status: resultado.advertencia ? 202 : 200 });
    } catch (error) {
        return errorToResponse(error, "[COMITE/EXPEDIENTE/ACTIVAR-EMERGENCIA]");
    }
}
