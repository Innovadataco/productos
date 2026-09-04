/**
 * SPEC-428 · GET /api/publico/profesionales/precio-primera-cita
 * Precio estándar (COP) de la primera cita — se muestra al padre en el perfil
 * del profesional y en la pantalla de pago. La tarifa del profesional aplica
 * desde la 2ª cita (informativa).
 *
 * Endpoint público — el precio estándar es un dato que el padre necesita ver
 * ANTES de autenticarse en el directorio; forma parte de la información pública
 * del catálogo. No expone parámetros internos ni la comisión.
 */
import { NextResponse } from "next/server";
import { errorToResponse } from "@/lib/api-handler";
import { leerPrecioEstandarPrimeraCita } from "@/lib/profesional/cita/precio-primera-cita";

export async function GET() {
    try {
        const cop = await leerPrecioEstandarPrimeraCita();
        return NextResponse.json({ data: { precioCOP: cop } });
    } catch (error) {
        return errorToResponse(error, "[PUBLICO/PROFESIONALES/PRECIO]");
    }
}
