import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { AnalisisPanelService } from "@/lib/dal/services/analisis-panel";

/**
 * SPEC-222 (002-PI-123, FR-003): Top 5 decisiones del día — recomendaciones
 * PENDIENTE no expiradas del motor de reglas (SPEC-221), orden
 * `prioridad DESC, generadaEn ASC`, máximo 5. Solo lectura; solo ADMIN.
 */
export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "estadisticas");
        if (String(user.rol) !== "ADMIN") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        // SPEC-053: las agregaciones viven en el DAL; la ruta no toca prisma.
        const resultado = await new AnalisisPanelService().topDecisiones();
        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[ADMIN/ANALISIS/TOP-DECISIONES]");
    }
}
