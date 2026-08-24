import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { ReglasAdminService } from "@/lib/dal/services/reglas-admin";

/**
 * SPEC-224 (002-PI-125, FR-011): historial de versiones de una regla, más
 * reciente primero, con admin, motivo y diff de campos cambiados. Solo lectura
 * (sin restauración automática en v1).
 * Guards: verifyAuth(ADMIN) + módulo `analisis_admin` + rate limit.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const paginacionSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "analisis_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const { page, pageSize } = paginacionSchema.parse({
            page: searchParams.get("page") ?? undefined,
            pageSize: searchParams.get("pageSize") ?? undefined,
        });

        const resultado = await new ReglasAdminService().historial(id, page, pageSize);
        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/REGLAS/HISTORIAL]");
    }
}
