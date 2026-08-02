import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol, puedeGestionarReporte } from "@/lib/operadores/permisos";
import { descifrarTextoReporte } from "@/lib/texto-reporte-cifrado";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "bandeja_reportes");
        if (!esAdminRol(user.rol) && user.rol !== "OPERADOR" && !esComiteRol(user.rol)) {
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

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const id = parsedId.data;

        // E-8: las lecturas viven en el repo; la ruta no toca prisma.
        const permisosReporte = await new ReporteRepository().findPermisosRevision(id);

        if (!permisosReporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (user.rol === "COMITE_VALIDACION" && permisosReporte.comiteId !== user.id) {
            return NextResponse.json(
                { error: { message: "No tienes permiso para ver este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        if (user.rol !== "COMITE_VALIDACION" && !puedeGestionarReporte(user, permisosReporte)) {
            return NextResponse.json(
                { error: { message: "No tienes permiso para ver este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const reporte = await new ReporteRepository().findDetalleRevision(id);

        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // SPEC-130 (BL-4, O-2): el texto sale descifrado SOLO por este camino
        // autorizado (bandeja/expediente del operador); purgado → marcador tal cual.
        return NextResponse.json({
            reporte: { ...reporte, texto: descifrarTextoReporte(reporte.texto) },
            puedeRevelarOriginal: user.rol === "ADMIN",
            puedeEscalar: (user.rol === "OPERADOR" && reporte?.operador?.id === user.id && reporte.estado === "REVISION_MANUAL") || esAdminRol(user.rol),
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
