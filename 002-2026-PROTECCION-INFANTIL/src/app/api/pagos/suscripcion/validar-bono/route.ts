/**
 * SPEC-211 (002-PI-111): POST /api/pagos/suscripcion/validar-bono
 *
 * Valida un código de bono promocional por su nombre público y devuelve el
 * descuento estimado + el `bonoId` para aplicarlo con SPEC-216. No persiste.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { withValidation } from "@/lib/validation";
import { validarCodigoBono } from "@/lib/pagos/validar-bono.service";

const validarBonoBodySchema = z.object({
    suscripcionId: z.string().min(1),
    codigo: z.string().trim().min(2).max(100),
});

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

        const body = await withValidation.body(validarBonoBodySchema)(request);
        const resultado = await validarCodigoBono(body.suscripcionId, body.codigo, usuario);
        return NextResponse.json(resultado, { status: 200 });
    } catch (error) {
        return errorToResponse(error, "[PAGOS/VALIDAR-BONO]");
    }
}
