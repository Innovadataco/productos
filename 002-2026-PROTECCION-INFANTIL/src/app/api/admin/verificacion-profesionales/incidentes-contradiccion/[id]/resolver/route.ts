/**
 * SPEC-787 · POST — el verificador registra el DESENLACE de un incidente de contradicción.
 * El estado (RESUELTO vs RESUELTO_TARDE) NO se guarda: lo DERIVA el reloj (estadoEfectivoIncidente).
 * `resueltoPor` = snapshot del verificador (el rastro sobrevive a la baja de la cuenta).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { resolverIncidenteContradiccion } from "@/lib/profesional/cita/bandeja-incidentes.service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "admin_verificacion_profesionales");
        const { id } = await context.params;
        await resolverIncidenteContradiccion(id, user.id);
        return NextResponse.json({ ok: true });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICACION/INCIDENTES-CONTRADICCION/RESOLVER]");
    }
}
