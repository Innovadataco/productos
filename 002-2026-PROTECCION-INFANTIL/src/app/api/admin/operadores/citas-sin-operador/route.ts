import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";

/**
 * SPEC-750/T014 · GET /api/admin/operadores/citas-sin-operador
 * Capacidad al admin (contrato §5): citas CONFIRMADAS que quedaron SIN operador (el trigger
 * al confirmar no encontró operador libre). El admin las ve «antes del día» para resolverlas.
 * Sin PII del padre — el repo proyecta id + franja + profesional (nombre visible).
 */
export async function GET() {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "operadores");
        const citas = await new SolicitudCitaRepository().listarCitasSinOperador();
        return NextResponse.json({ data: citas });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/OPERADORES/CITAS-SIN-OPERADOR]");
    }
}
