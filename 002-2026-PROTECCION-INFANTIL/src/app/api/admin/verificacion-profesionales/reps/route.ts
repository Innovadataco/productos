/**
 * SPEC-790 (T6) · GET /api/admin/verificacion-profesionales/reps — lista para la pantalla de carga manual
 * de verificación REPS: los profesionales `ACTIVO` con su estado REPS DERIVADO (última fila; sin fila →
 * `SIN_VERIFICAR`, el caso normal de hoy). Mismo módulo que las otras colas del verificador
 * (`admin_verificacion_profesionales`). La guardia es del SERVIDOR (no se esconde un botón): el rol decide
 * acá. La carga (POST) vive en `[id]/reps`; esta ruta SOLO lee.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";

export async function GET() {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "admin_verificacion_profesionales");
        const data = await new PerfilProfesionalRepository().listarParaCargaReps();
        return NextResponse.json({ data });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICACION-PROFESIONALES/REPS/LISTA]");
    }
}
