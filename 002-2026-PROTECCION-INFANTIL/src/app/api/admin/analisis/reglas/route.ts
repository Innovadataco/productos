import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { ReglasAdminService } from "@/lib/dal/services/reglas-admin";
import { crearReglaSchema, listaReglasQuerySchema } from "@/lib/schemas/analisis-reglas";

/**
 * SPEC-224 (002-PI-125, FR-002/FR-003/FR-004): catálogo de reglas del motor de
 * recomendaciones — lista paginada (orden prioridad desc, conteo 7d) y creación
 * (toda regla nace en RECOMIENDA, version 1; clave única → 409).
 * Guards: verifyAuth(ADMIN) + módulo `analisis_admin` + rate limit.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
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

        const { searchParams } = new URL(request.url);
        const query = listaReglasQuerySchema.parse({
            page: searchParams.get("page") ?? undefined,
            pageSize: searchParams.get("pageSize") ?? undefined,
            activa: searchParams.get("activa") ?? undefined,
            q: searchParams.get("q") ?? undefined,
        });

        const resultado = await new ReglasAdminService().listar(query);
        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/REGLAS]");
    }
}

export async function POST(request: Request) {
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

        const body = await parseBody(request, crearReglaSchema);
        const regla = await new ReglasAdminService().crear(body, {
            usuarioId: admin.id,
            ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined,
            userAgent: request.headers.get("user-agent") ?? undefined,
        });
        return NextResponse.json(regla, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/REGLAS]");
    }
}
