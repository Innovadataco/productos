import { NextResponse } from "next/server";
import { EstadoPago } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { pagosQuerySchema } from "@/lib/schemas/pagos";
import { paginatedResponse } from "@/lib/pagos/api-helpers";

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "pagos_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const parsed = pagosQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, q } = parsed.data;
        const repo = new PagosRepository();
        const where: { estado: typeof EstadoPago.REEMBOLSADO; OR?: Array<{ suscripcion: { colegio?: { nombre?: { contains: string; mode: "insensitive" } }; usuario?: { nombre?: { contains: string; mode: "insensitive" }; email?: { contains: string; mode: "insensitive" } } } }> } = {
            estado: EstadoPago.REEMBOLSADO,
        };
        if (q) {
            where.OR = [
                { suscripcion: { colegio: { nombre: { contains: q, mode: "insensitive" } } } },
                { suscripcion: { usuario: { nombre: { contains: q, mode: "insensitive" } } } },
                { suscripcion: { usuario: { email: { contains: q, mode: "insensitive" } } } },
            ];
        }

        const [items, total] = await Promise.all([
            repo["db"].pago.findMany({
                where,
                orderBy: { updatedAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    suscripcion: {
                        include: {
                            colegio: { select: { id: true, nombre: true } },
                            usuario: { select: { id: true, nombre: true, email: true } },
                        },
                    },
                },
            }),
            repo["db"].pago.count({ where }),
        ]);

        return NextResponse.json(paginatedResponse(items, page, pageSize, total));
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/REEMBOLSOS]");
    }
}
