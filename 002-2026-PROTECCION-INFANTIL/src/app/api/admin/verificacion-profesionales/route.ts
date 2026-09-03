/**
 * SPEC-408 · GET /api/admin/verificacion-profesionales — cola de solicitudes
 * en `EN_REVISION`. Solo la ve quien tiene el módulo
 * `admin_verificacion_profesionales` (ADMIN por default, VERIFICADOR por rol).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { listarSolicitudesEnRevision } from "@/lib/profesionales/verificador/service";

export async function GET() {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "admin_verificacion_profesionales");
        const data = await listarSolicitudesEnRevision();
        return NextResponse.json({ data });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICACION-PROFESIONALES/LIST]");
    }
}
