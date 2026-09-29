/**
 * SPEC-787 · GET — la bandeja de «reportes que no coinciden» del verificador (incidentes de
 * contradicción de encuestas, SPEC-753). Mismo módulo que las otras colas del verificador.
 * Superficie 100% interna: solo el verificador; nunca padre ni profesional.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { listarBandejaIncidentes } from "@/lib/profesional/cita/bandeja-incidentes.service";

export async function GET() {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "admin_verificacion_profesionales");
        return NextResponse.json(await listarBandejaIncidentes());
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICACION/INCIDENTES-CONTRADICCION]");
    }
}
