import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { ReglasAdminService } from "@/lib/dal/services/reglas-admin";
import { editarReglaSchema } from "@/lib/schemas/analisis-reglas";

/**
 * SPEC-224 (002-PI-125, FR-004/FR-005/FR-010): detalle y edición de una regla.
 * La edición exige motivo (versionado: snapshot + version+1 en la misma TX);
 * `clave` es inmutable y `modo` no es editable aquí (→ 400, usar /modo).
 * Guards: verifyAuth(ADMIN) + módulo `analisis_admin` + rate limit.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ContextoRuta = { params: Promise<{ id: string }> };

function contextoAudit(request: Request, adminId: string) {
    return {
        usuarioId: adminId,
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
    };
}

export async function GET(request: Request, { params }: ContextoRuta) {
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
        const regla = await new ReglasAdminService().obtenerDetalle(id);
        return NextResponse.json(regla);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/REGLAS/ID]");
    }
}

export async function PATCH(request: Request, { params }: ContextoRuta) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "analisis_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = await params;
        const body = await parseBody(request, editarReglaSchema);
        const regla = await new ReglasAdminService().actualizar(id, body, contextoAudit(request, admin.id));
        return NextResponse.json(regla);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/REGLAS/ID]");
    }
}
