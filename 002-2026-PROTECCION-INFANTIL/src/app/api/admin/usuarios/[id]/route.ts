import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { whereReporteVigente } from "@/lib/reportes-acceso";

/**
 * GET /api/admin/usuarios/[id] (SPEC-194, 002-PI-088)
 * Detalle de cuenta de usuario + historial agregado de reportes (metadatos).
 * Nunca expone texto, identificador ni datos del denunciante.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "usuarios_admin");
        const rate = await checkRateLimit(_request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = await params;
        const parsedId = idSchema.safeParse(id);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const usuario = await new UsuarioRepository().findById(parsedId.data);
        if (!usuario) {
            return NextResponse.json(
                { error: { message: "Usuario no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const reportes = await new ReporteRepository().findPaginadosConTotal(
            whereReporteVigente({ usuarioId: usuario.id }),
            { skip: 0, take: 1000 }
        );

        const reportesItems = reportes[0].map((r) => ({
            id: r.id,
            estado: r.estado,
            creadoEn: r.creadoEn.toISOString(),
            esAnonimo: r.esAnonimo,
            plataforma: r.plataforma ? { nombre: r.plataforma.nombre, clave: r.plataforma.clave } : null,
            clasificacion: r.clasificacion
                ? { categoria: r.clasificacion.categoria, confianza: r.clasificacion.confianza }
                : null,
        }));

        return NextResponse.json({
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            rol: usuario.rol,
            estado: usuario.estado,
            creadoEn: usuario.creadoEn.toISOString(),
            ultimaSesion: usuario.ultimaSesion?.toISOString() ?? null,
            reportes: { items: reportesItems, total: reportes[1] },
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
