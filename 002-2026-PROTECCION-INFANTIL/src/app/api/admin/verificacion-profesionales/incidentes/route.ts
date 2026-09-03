/**
 * SPEC-408 · GET /api/admin/verificacion-profesionales/incidentes
 *
 * Cola 2 del Verificador — citas en `SIN_CONFIRMAR` con la traza de códigos a
 * la vista (traza cableada, sin instrumentar todavía: los códigos de cita y
 * expediente vienen en un spec posterior · brief §9 momento 6).
 *
 * Gate por el MISMO módulo que la cola 1 — un Verificador, un módulo (decisión
 * CEO 03-09 15:38 · lección I-278 de duplicar superficie de permisos).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { listarIncidentesCitas } from "@/lib/profesionales/verificador/service";

export async function GET() {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "admin_verificacion_profesionales");
        const data = await listarIncidentesCitas();
        return NextResponse.json({ data });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICACION-PROFESIONALES/INCIDENTES]");
    }
}
