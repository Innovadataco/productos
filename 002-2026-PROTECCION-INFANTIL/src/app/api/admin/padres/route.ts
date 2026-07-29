import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { padresQuerySchema } from "@/lib/validators";
import { whereReporteVigente } from "@/lib/reportes-acceso";

/**
 * GET /api/admin/padres (spec 117, I-37)
 * Listado de cuentas PARENT para soporte de credenciales. Privacidad: solo metadatos
 * de cuenta y conteo agregado de reportes; nunca textos, identificadores ni menores.
 */
export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "padres");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const parsedQuery = padresQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedQuery.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, q } = parsedQuery.data;
        const where: Prisma.UsuarioWhereInput = { rol: "PARENT" };
        if (q) {
            where.OR = [
                { email: { contains: q, mode: "insensitive" } },
                { nombre: { contains: q, mode: "insensitive" } },
            ];
        }

        const [padres, total] = await Promise.all([
            prisma.usuario.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    email: true,
                    nombre: true,
                    estado: true,
                    debeCambiarPassword: true,
                    creadoEn: true,
                    ultimaSesion: true,
                    // SPEC-119: ventana de servicio del cliente padre.
                    inicioServicio: true,
                    finServicio: true,
                },
            }),
            prisma.usuario.count({ where }),
        ]);

        // Conteo agregado de reportes (sin contenido) para las cuentas de la página
        const ids = padres.map((p) => p.id);
        const conteos = ids.length
            ? await prisma.reporte.groupBy({
                  by: ["usuarioId"],
                  where: whereReporteVigente({ usuarioId: { in: ids } }),
                  _count: { _all: true },
              })
            : [];
        const conteoPorUsuario = new Map(conteos.map((c) => [c.usuarioId, c._count._all]));

        const items = padres.map((p) => ({ ...p, reportes: conteoPorUsuario.get(p.id) ?? 0 }));

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
