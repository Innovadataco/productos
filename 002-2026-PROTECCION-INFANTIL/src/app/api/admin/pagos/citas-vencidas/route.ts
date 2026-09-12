/**
 * SPEC-658 (I-393) · GET /api/admin/pagos/citas-vencidas — las citas donde el padre
 * PAGÓ y el profesional dejó pasar las 48 h (estado VENCIDA_SIN_RESPUESTA ∧ pago
 * presente). Existe para que un admin VEA que hay dinero por mirar; NO decide ni
 * mueve plata (si se devuelve, cuánto y cuándo lo decide Jelkin — I-393). Vive en el
 * módulo `pagos_admin`, junto al libro de reembolsos.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "pagos_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const items = await new SolicitudCitaRepository().listarVencidasConPagoParaAdmin();
        return NextResponse.json({ items });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/CITAS-VENCIDAS]");
    }
}
