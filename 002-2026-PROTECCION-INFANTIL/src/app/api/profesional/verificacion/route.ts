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
        // SPEC-706: se retiró el módulo `profesional_verificacion` (su menú desapareció). Esta ruta quedó
        // SIN uso en la UI (el estado vive en la ficha, el envío va por el PUT del perfil); se gatea
        // con `profesional_ficha` por ahora. Candidata a retiro en un follow-up.
        await assertModulo(user, "profesional_ficha");
        const data = await verificacionParaProfesional(user.id);
        return NextResponse.json({ data });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/VERIFICACION/GET]");
    }
}
