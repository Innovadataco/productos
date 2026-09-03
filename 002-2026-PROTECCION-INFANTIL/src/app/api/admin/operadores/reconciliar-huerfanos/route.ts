import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { reconciliarHuerfanos } from "@/lib/operadores/reconciliacion-huerfanos";

/**
 * POST /api/admin/operadores/reconciliar-huerfanos (SPEC-372 · A-74 P3)
 * Dispara la reconciliación de huérfanos EN EL MOMENTO, sin esperar el cron
 * de cada 15 min. El botón "Asignar huérfanos ahora" del tablero de admin
 * llama acá. Corre sync: el admin ve el resumen (encontrados / asignados /
 * fallidos) apenas termina — el propio `reconciliarHuerfanos` audita cuando
 * hay asignados, y acá auditamos el DISPARO manual (quién lo pidió).
 */
export async function POST(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "operadores");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const resumen = await reconciliarHuerfanos();

        await logAudit({
            accion: "RECONCILIACION_HUERFANOS",
            tipoRecurso: "Operador",
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({
                disparo: "manual",
                encontrados: resumen.encontrados,
                asignados: resumen.asignados,
                fallidos: resumen.fallidos,
                deshabilitado: resumen.deshabilitado ?? false,
            }),
        });

        return NextResponse.json(resumen);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/OPERADORES/RECONCILIAR-HUERFANOS]");
    }
}
