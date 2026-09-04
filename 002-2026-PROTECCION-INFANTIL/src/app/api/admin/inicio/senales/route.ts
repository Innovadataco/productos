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
 *
 * SPEC-414: `?prueba=1` es el mismo interruptor que la pantalla — las colas de
 * trabajo vuelven a contar lo sembrado. Sin el parámetro se devuelve solo lo
 * real, que es el default del producto. La respuesta siempre trae
 * `incluyeSembrados` y `sembrados`, así que quien consuma el endpoint sabe qué
 * está mirando sin tener que adivinar por el parámetro.
 */
export async function GET(request: Request) {
    try {
        const user = await verifyAuth("ADMIN");
        await assertModulo(user, "inicio_admin");
        const incluirSembrados = new URL(request.url).searchParams.get("prueba") === "1";
        const estado = await calcularEstadoInicio({ incluirSembrados });
        return NextResponse.json(estado, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/INICIO/SENALES]");
    }
}
