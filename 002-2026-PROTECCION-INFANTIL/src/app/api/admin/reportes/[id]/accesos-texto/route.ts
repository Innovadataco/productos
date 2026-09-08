import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertAnyModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol, puedeGestionarReporte } from "@/lib/operadores/permisos";
import { LecturaReporteRepository } from "@/lib/dal/repositories/lectura-reporte";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";

/**
 * GET /api/admin/reportes/[id]/accesos-texto — SPEC-584 (Fase 2).
 *
 * «Historial de accesos al texto» del reporte: quién (usuario/rol o actor
 * externo), cuándo y qué campo vio. Visible para ADMIN/OPERADOR/COMITE_VALIDACION
 * con permiso sobre el caso (misma autorización fina que el detalle de revisión).
 * Los padres NO ven este historial. Solo metadatos: nunca contenido.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertAnyModulo(user, ["bandeja_reportes", "comite_bandeja"]);
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

        const permisosReporte = await new ReporteRepository().findPermisosRevision(id);
        if (!permisosReporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (user.rol === "COMITE_VALIDACION" && permisosReporte.comiteId !== user.id) {
            return NextResponse.json(
                { error: { message: "No tiene permiso para ver este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        if (user.rol !== "COMITE_VALIDACION" && !puedeGestionarReporte(user, permisosReporte)) {
            return NextResponse.json(
                { error: { message: "No tiene permiso para ver este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const items = await new LecturaReporteRepository().historialPorReporte(id);
        return NextResponse.json({ items });
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
