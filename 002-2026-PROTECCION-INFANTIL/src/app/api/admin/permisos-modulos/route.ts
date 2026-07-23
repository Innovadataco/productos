import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { rolesConocidos, obtenerRolesProtegidos } from "@/lib/permisos-modulos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

const patchSchema = z.object({
    cambios: z
        .array(
            z.object({
                rol: z.string().min(1).max(50),
                moduloId: z.string().min(1),
                activo: z.boolean(),
            })
        )
        .min(1)
        .max(100),
});

/**
 * GET /api/admin/permisos-modulos
 * Matriz completa: roles conocidos × árbol de módulos × permisos actuales.
 */
export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "configuracion_permisos");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const [roles, modulos, permisos, rolesProtegidos] = await Promise.all([
            rolesConocidos(),
            prisma.moduloPermisible.findMany({
                where: { padreId: null },
                include: { submodulos: { orderBy: { orden: "asc" } } },
                orderBy: { orden: "asc" },
            }),
            prisma.permisoModulo.findMany({
                select: { rol: true, moduloId: true, activo: true },
            }),
            obtenerRolesProtegidos(),
        ]);

        return NextResponse.json({
            roles,
            rolesProtegidos,
            modulos,
            permisos,
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

/**
 * PATCH /api/admin/permisos-modulos
 * Aplica cambios de permisos por rol con validación anti-lockout y auditoría.
 * El rol se valida contra los roles conocidos (un typo devuelve 400, no crea fila fantasma).
 */
export async function PATCH(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "configuracion_permisos");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = patchSchema.safeParse(await request.json());
        if (!body.success) {
            throw new AppError("Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const { cambios } = body.data;

        // Validar roles contra los conocidos (enum RolUsuario ∪ roles ya usados)
        const conocidos = await rolesConocidos();
        const desconocidos = [...new Set(cambios.map((c) => c.rol))].filter((r) => !conocidos.includes(r));
        if (desconocidos.length > 0) {
            throw new AppError(
                `Roles desconocidos: ${desconocidos.join(", ")}. Roles válidos: ${conocidos.join(", ")}`,
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        // Validar módulos
        const moduloIds = [...new Set(cambios.map((c) => c.moduloId))];
        const modulos = await prisma.moduloPermisible.findMany({ where: { id: { in: moduloIds } } });
        if (modulos.length !== moduloIds.length) {
            throw new AppError("Uno o más módulos no existen", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        // Anti-lockout: simular el estado final y exigir que cada módulo crítico
        // conserve al menos un rol protegido activo.
        const rolesProtegidos = await obtenerRolesProtegidos();
        const criticos = await prisma.moduloPermisible.findMany({ where: { esCritico: true } });
        const permisosActuales = await prisma.permisoModulo.findMany({
            where: { rol: { in: rolesProtegidos }, moduloId: { in: criticos.map((m) => m.id) } },
        });
        const estadoFinal = new Map(permisosActuales.map((p) => [`${p.rol}:${p.moduloId}`, p.activo]));
        for (const cambio of cambios) {
            estadoFinal.set(`${cambio.rol}:${cambio.moduloId}`, cambio.activo);
        }
        for (const critico of criticos) {
            const algunoActivo = rolesProtegidos.some((rol) => estadoFinal.get(`${rol}:${critico.id}`) === true);
            if (!algunoActivo) {
                throw new AppError(
                    `No se puede dejar a la plataforma sin acceso al módulo crítico "${critico.nombre}" (roles protegidos: ${rolesProtegidos.join(", ")})`,
                    ERROR_CODES.CONFLICT,
                    409
                );
            }
        }

        // Snapshot para auditoría
        const anteriores = await prisma.permisoModulo.findMany({
            where: { OR: cambios.map((c) => ({ rol: c.rol, moduloId: c.moduloId })) },
            select: { rol: true, moduloId: true, activo: true },
        });

        await prisma.$transaction(
            cambios.map((c) =>
                prisma.permisoModulo.upsert({
                    where: { rol_moduloId: { rol: c.rol, moduloId: c.moduloId } },
                    update: { activo: c.activo, actualizadoPorId: admin.id },
                    create: { rol: c.rol, moduloId: c.moduloId, activo: c.activo, actualizadoPorId: admin.id },
                })
            )
        );

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "PERMISOS_MODULO_ACTUALIZADOS",
            tipoRecurso: "PermisoModulo",
            usuarioId: admin.id,
            valorAnterior: JSON.stringify(anteriores),
            valorNuevo: JSON.stringify(cambios),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ actualizados: cambios.length });
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
