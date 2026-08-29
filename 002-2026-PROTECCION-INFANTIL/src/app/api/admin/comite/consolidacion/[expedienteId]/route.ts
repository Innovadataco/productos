import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";
import { estadoPermiteAccion, obtenerDetalleConsolidacion } from "@/lib/comite/consolidacion";

/**
 * SPEC-237 (002-PI-mega-cola): detalle de un informe consolidado para la
 * vista de consolidación del comité. Lectura: COMITE_VALIDACION y ADMIN
 * (los permisos de acción se exponen en `permisos` para que la UI oculte
 * los botones; la autorización real vive en los endpoints POST).
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ expedienteId: string }> }
) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "comite_bandeja");
        if (!esAdminRol(user.rol) && !esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { expedienteId } = await params;
        const detalle = await obtenerDetalleConsolidacion(expedienteId);

        const puedeActuar = esComiteRol(user.rol) && estadoPermiteAccion(detalle.informe.estadoAprobacion);
        return NextResponse.json({
            ...detalle,
            permisos: {
                puedeAprobar: puedeActuar,
                puedeCorregir: puedeActuar,
                puedeDevolver: puedeActuar,
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[ComiteConsolidacion] Error obteniendo detalle:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
