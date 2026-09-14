/**
 * SPEC-693 (I-416) · GET /api/admin/verificacion-profesionales/renovaciones —
 * cola «Documentos nuevos»: profesionales ACTIVOS que subieron una versión nueva de
 * un requisito. Mismo módulo que la cola de solicitudes (`admin_verificacion_profesionales`).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { listarRenovaciones } from "@/lib/profesionales/verificador/service";

export async function GET() {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "admin_verificacion_profesionales");
        const data = await listarRenovaciones();
        return NextResponse.json({ data });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICACION-PROFESIONALES/RENOVACIONES]");
    }
}
