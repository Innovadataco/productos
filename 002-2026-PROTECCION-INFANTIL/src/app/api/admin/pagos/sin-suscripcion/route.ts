/**
 * SPEC-245 (002-PI-148): listado de usuarios/colegios sin suscripción vigente
 * para el tab "Sin suscripción" del panel admin de pagos.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { pagosSinSuscripcionQuerySchema } from "@/lib/schemas/pagos";
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
        const parsed = pagosSinSuscripcionQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, tipo, q } = parsed.data;
        const filtros: { tipo?: "PADRE" | "COLEGIO"; q?: string } = {};
        if (tipo) filtros.tipo = tipo;
        if (q) filtros.q = q;

        const { items, total } = await new PagosRepository().listarSinSuscripcion(
            filtros,
            { skip: (page - 1) * pageSize, take: pageSize }
        );

        return NextResponse.json(paginatedResponse(items, page, pageSize, total));
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/SIN-SUSCRIPCION]");
    }
}
