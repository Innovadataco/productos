/**
 * SPEC-211 (002-PI-111): GET /api/pagos/suscripcion
 *
 * Devuelve la suscripción propia del cliente autenticado (SCHOOL_ADMIN → la de
 * su colegio; PARENT → la suya) con resumen, historial de pagos, código de
 * referido y opciones de renovación. 404 si el titular aún no tiene suscripción.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { obtenerVistaSuscripcion } from "@/lib/pagos/suscripcion-vista.service";

export async function GET(request: Request) {
    try {
        const usuario = await verifyAuth(["SCHOOL_ADMIN", "PARENT"]);
        const rate = await checkRateLimit(request, "pagos_read", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const vista = await obtenerVistaSuscripcion(usuario);
        if (!vista) {
            return NextResponse.json(
                { error: { message: "El titular no tiene una suscripción registrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json(vista, { status: 200 });
    } catch (error) {
        return errorToResponse(error, "[PAGOS/SUSCRIPCION]");
    }
}
