/**
 * SPEC-247 (002-PI-150): GET /api/pagos/suscripcion/estado
 *
 * Devuelve únicamente el estado de la suscripción autenticada (PARENT o
 * SCHOOL_ADMIN). Endpoint ligero para el polling de EsperandoAutorizacion.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { obtenerSuscripcionTitular } from "@/lib/pagos/suscripcion-vista.service";

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

        const suscripcion = await obtenerSuscripcionTitular(usuario);
        return NextResponse.json(
            { estado: suscripcion?.estado ?? "INEXISTENTE" },
            { status: 200 }
        );
    } catch (error) {
        return errorToResponse(error, "[PAGOS/SUSCRIPCION/ESTADO]");
    }
}
