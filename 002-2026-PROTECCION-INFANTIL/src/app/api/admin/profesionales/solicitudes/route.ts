/**
 * SPEC-421 · GET /api/admin/profesionales/solicitudes — solicitudes de registro
 * pendientes de profesionales (TokenRegistro rol=PROFESIONAL, no usado, no
 * vencido). Devuelve email + creadoEn + expiraEn — NUNCA el token en claro ni
 * el hash. El token en claro solo vive en el correo, y si el correo no salió,
 * el reenviar (POST hermano) lo entrega en pantalla una sola vez.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { ProfesionalesAdminService } from "@/lib/dal/services/profesionales-admin";

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "profesionales_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const items = await new ProfesionalesAdminService().listarSolicitudesPendientes();
        return NextResponse.json({ items });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PROFESIONALES/SOLICITUDES]");
    }
}
