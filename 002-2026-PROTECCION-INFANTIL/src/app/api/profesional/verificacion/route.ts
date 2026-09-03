/**
 * SPEC-408 · GET /api/profesional/verificacion — el profesional ve su estado
 * y las observaciones que le dejó el Verificador. Nada más.
 *
 * Payload de retorno: `{ estadoPerfil, puedeReenviar, observaciones[] }`.
 * NO expone `resultado`, `checklist` estructurado, `revisadoPor`, `notaInterna`
 * ni `autorizacionArchivoUrl`. Ver `vista-profesional.ts` para el candado.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { verificacionParaProfesional } from "@/lib/profesionales/verificador/vista-profesional";

export async function GET() {
    try {
        const user = await verifyAuth("PROFESIONAL");
        const data = await verificacionParaProfesional(user.id);
        return NextResponse.json({ data });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/VERIFICACION/GET]");
    }
}
