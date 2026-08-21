import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { usuariosQuerySchema } from "@/lib/validators";
import { construirWhereUsuarios } from "@/lib/analytics/usuarios-query";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { whereReporteVigente } from "@/lib/reportes-acceso";

/**
 * GET /api/admin/usuarios (SPEC-194, 002-PI-088)
 * Listado de usuarios por rol para el admin. Empieza por PARENT (I-37).
 * Solo metadatos de cuenta y conteos agregados; nunca textos de reportes.
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

        const { page, pageSize, rol, q, estado, desde, hasta, conReportes, colegioId } = parsedQuery.data;
        const where = construirWhereUsuarios({ rol, q, estado, desde, hasta, conReportes, colegioId });

        const [usuarios, total] = await new UsuarioRepository().findUsuariosAdminPaginados(where, {
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        const ids = usuarios.map((u) => u.id);
        const conteos = ids.length
            ? await new ReporteRepository().contarPorUsuarios(whereReporteVigente({ usuarioId: { in: ids } }))
            : [];
        const conteoPorUsuario = new Map(conteos.map((c) => [c.usuarioId, c._count._all]));

        const items = usuarios.map((u) => ({
            id: u.id,
            email: u.email,
            nombre: u.nombre,
            estado: u.estado,
            creadoEn: u.creadoEn.toISOString(),
            ultimaSesion: u.ultimaSesion?.toISOString() ?? null,
            reportesEnviados: conteoPorUsuario.get(u.id) ?? 0,
            colegiosAsociados: u.colegio ? [{ id: u.colegio.id, nombre: u.colegio.nombre }] : [],
        }));

        return NextResponse.json({
            items,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
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
