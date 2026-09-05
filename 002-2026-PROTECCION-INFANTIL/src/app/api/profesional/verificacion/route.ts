/**
 * SPEC-408 · GET /api/profesional/verificacion — el profesional ve su estado
 * y las observaciones que le dejó el Verificador. Nada más.
 *
 * Payload de retorno: `{ estadoPerfil, puedeReenviar, observaciones[] }`.
 * NO expone `resultado`, `checklist` estructurado, `revisadoPor`, `notaInterna`
 * ni `autorizacionArchivoId`. Ver `vista-profesional.ts` para el candado.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { verificacionParaProfesional } from "@/lib/profesionales/verificador/vista-profesional";

export async function GET() {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await assertModulo(user, "profesional_verificacion");
        const data = await verificacionParaProfesional(user.id);
        return NextResponse.json({ data });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/VERIFICACION/GET]");
    }
}
