/**
 * SPEC-425 (A-75 · L5) · GET /api/profesional/panel
 *
 * Todo lo que el inicio del profesional muestra, en una sola lectura. El
 * servicio no expone nada que el DTO de L4 no exponga ya: nombres de familia
 * sí, contacto del padre no — eso sigue gobernado por `debeExponerContacto`.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { panelDelProfesional } from "@/lib/profesional/panel/panel.service";

export async function GET() {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await assertModulo(user, "profesional_inicio");
        const data = await panelDelProfesional(user.id);
        return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/PANEL/GET]");
    }
}
