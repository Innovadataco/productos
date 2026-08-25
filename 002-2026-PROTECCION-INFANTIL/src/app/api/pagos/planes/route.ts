/**
 * SPEC-244 (002-PI-147): GET /api/pagos/planes
 *
 * Lista los planes activos para el rol del usuario autenticado (SCHOOL_ADMIN o
 * PARENT) del año actual. Usado por el selector de planes de suscripción.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PagosClienteRepository } from "@/lib/dal/repositories/pagos-cliente-repository";
import { anioBogota } from "@/lib/pagos/renovacion-calculos";

function rolATipoTitular(rol: "SCHOOL_ADMIN" | "PARENT"): "COLEGIO" | "PADRE" {
    return rol === "SCHOOL_ADMIN" ? "COLEGIO" : "PADRE";
}

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

        const tipoTitular = rolATipoTitular(usuario.rol as "SCHOOL_ADMIN" | "PARENT");
        const planes = await new PagosClienteRepository().listarPlanesActivosPorTitular(tipoTitular, anioBogota());

        return NextResponse.json({ planes }, { status: 200 });
    } catch (error) {
        return errorToResponse(error, "[PAGOS/PLANES]");
    }
}
