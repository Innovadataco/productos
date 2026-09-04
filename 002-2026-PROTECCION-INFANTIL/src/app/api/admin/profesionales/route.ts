/**
 * SPEC-421 · GET /api/admin/profesionales — listado paginado de cuentas
 * PROFESIONAL con filtro por email/nombre. Espejo de `/api/admin/padres`
 * (orden Jelkin 20:5x). El admin NO crea cuentas — el psicólogo se
 * registra vía `/registro-profesional/solicitar`.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { ProfesionalesAdminService } from "@/lib/dal/services/profesionales-admin";

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().min(2).max(120).optional(),
});

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "profesionales_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const url = new URL(request.url);
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }
        const { page, pageSize, q } = parsed.data;
        const { items, total } = await new ProfesionalesAdminService().listar({ page, pageSize, q });
        return NextResponse.json({
            items,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PROFESIONALES]");
    }
}
