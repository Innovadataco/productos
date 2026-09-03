import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { calcularEstadoInicio } from "@/lib/dal/services/inicio-admin";

/**
 * GET /api/admin/inicio/senales (SPEC-378)
 * Devuelve el estado de la alarma de la casa para el Inicio del administrador.
 * Vacío = todo tranquilo. Con `alertas` = algo se rompió en silencio y hay que
 * abrir la ruta señalada. La página server component consume este endpoint.
 * Sin cache (`no-store`): el admin quiere ver el estado ahora, no hace 5 min.
 */
export async function GET() {
    try {
        const user = await verifyAuth("ADMIN");
        await assertModulo(user, "inicio_admin");
        const estado = await calcularEstadoInicio();
        return NextResponse.json(estado, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/INICIO/SENALES]");
    }
}
