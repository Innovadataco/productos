import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { ReglasAdminService } from "@/lib/dal/services/reglas-admin";
import { testSqlSchema } from "@/lib/schemas/analisis-reglas";

/**
 * SPEC-224 (002-PI-125, FR-007): test de la query de una regla contra datos
 * reales en SOLO LECTURA — validador estático (FR-006) + envoltura LIMIT +
 * transacción READ ONLY con statement_timeout acotado. Devuelve columnas,
 * muestra de filas y duración; audita REGLA_SQL_TEST solo con metadatos
 * (huella del query, duración, filas), nunca el contenido de las filas.
 * Guards: verifyAuth(ADMIN) + módulo `analisis_admin` + rate limit admin_write.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

        const body = await parseBody(request, testSqlSchema);
        const resultado = await new ReglasAdminService().probarSql(body, {
            usuarioId: admin.id,
            ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined,
            userAgent: request.headers.get("user-agent") ?? undefined,
        });
        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/REGLAS/TEST-SQL]");
    }
}
