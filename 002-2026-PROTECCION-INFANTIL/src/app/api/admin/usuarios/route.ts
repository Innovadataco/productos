import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { usuariosQuerySchema } from "@/lib/validators";
import { UsuariosConsolidadoService } from "@/lib/dal/services/usuarios-consolidado";
import type { RolUsuariosListado } from "@/lib/dal/types/usuarios-consolidado";

/**
 * GET /api/admin/usuarios (SPEC-205, 002-PI-102)
 * Listado consolidado por rol. Fuente única para KPI y tablas.
 */
export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "usuarios_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const parsedQuery = usuariosQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedQuery.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, rol, q, estado, conReportes } = parsedQuery.data;
        const servicio = new UsuariosConsolidadoService();
        const resultado = await servicio.listarPorRol(rol as RolUsuariosListado, { q, estado, conReportes }, { page, pageSize });

        return NextResponse.json(resultado);
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
