/**
 * SPEC-245 (002-PI-148): activación manual de suscripción por admin.
 *
 * Crea una `Suscripcion` `ACTIVA` con origen `ACTIVADA_MANUAL_ADMIN` a partir de
 * los datos de pago manual capturados en el modal del panel admin.
 */
import { NextResponse } from "next/server";
import { TipoTitular } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { withValidation } from "@/lib/validation";
import { pagosActivarManualBodySchema } from "@/lib/schemas/pagos";
import { activarSuscripcionManual } from "@/lib/pagos/admin-activacion-manual.service";
import { getClientInfo } from "@/lib/pagos/api-helpers";

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "pagos_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await withValidation.body(pagosActivarManualBodySchema)(request);

        const tipoTitular: TipoTitular = body.usuarioObjetivoId ? "PADRE" : "COLEGIO";
        const target =
            tipoTitular === "PADRE"
                ? { tipoTitular, usuarioId: body.usuarioObjetivoId }
                : { tipoTitular, colegioId: body.colegioObjetivoId };

        const { ipAddress, userAgent } = getClientInfo(request);
        const suscripcion = await activarSuscripcionManual({
            adminId: admin.id,
            target,
            planId: body.planId,
            metodoPagoManual: body.metodoPagoManual,
            referenciaPagoManual: body.referenciaPagoManual,
            montoRealPagado: body.montoRealPagado,
            fechaPagoReal: body.fechaPagoReal,
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ suscripcion }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/ACTIVAR-MANUAL]");
    }
}
