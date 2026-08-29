/**
 * SPEC-215 (002-PI-115): POST /api/pagos/aplicar-referido
 *
 * Aplica un código de referido ajeno a la suscripción del cliente autenticado
 * (SCHOOL_ADMIN o PARENT). Valida titularidad, código activo, anti-autorreferido,
 * duplicado y tope anual; crea el `CodigoReferidoUso` y emite `referido.registrado`.
 * Contrato: `specs/215-referidos-pagos/contracts/215-referidos.md`.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { withValidation } from "@/lib/validation";
import { pagosAplicarReferidoBodySchema } from "@/lib/schemas/pagos";
import { aplicarCodigoReferido } from "@/lib/pagos/referido.service";
import { getClientInfo } from "@/lib/pagos/api-helpers";

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth(["SCHOOL_ADMIN", "PARENT"]);
        const rate = await checkRateLimit(request, "pagos_write", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await withValidation.body(pagosAplicarReferidoBodySchema)(request);
        const { ipAddress, userAgent } = getClientInfo(request);

        const resultado = await aplicarCodigoReferido({
            suscripcionId: body.suscripcionId,
            codigoReferido: body.codigoReferido,
            usuario: {
                id: usuario.id,
                rol: usuario.rol,
                colegioId: usuario.colegioId,
                email: usuario.email,
            },
            ipAddress,
            userAgent,
        });

        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[PAGOS/APLICAR-REFERIDO]");
    }
}
