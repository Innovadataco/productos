import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { pagosMoraQuerySchema } from "@/lib/schemas/pagos";
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
        const parsed = pagosMoraQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, estado } = parsed.data;
        const { items, total } = await new PagosRepository().listarMora(
            { estado },
            { skip: (page - 1) * pageSize, take: pageSize }
        );

        return NextResponse.json(paginatedResponse(items, page, pageSize, total));
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/MORA]");
    }
}
