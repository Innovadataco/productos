import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { reconciliarHuerfanos } from "@/lib/operadores/reconciliacion-huerfanos";

/**
 * POST /api/admin/operadores/reconciliacion (SPEC-372 · A-74 · P3)
 *
 * Dispara AHORA `reconciliarHuerfanos` — el mismo trabajo que hace el cron cada
 * 15 min (worker `operadores-reconciliacion-huerfanos`), sin esperar. Sirve para
 * el botón "Asignar huérfanos ahora" del admin: si hay una cola atrasada
 * porque el worker está caído o porque acaba de activarse un operador nuevo,
 * el admin la mueve al toque.
 *
 * · Solo ADMIN con módulo "operadores".
 * · Rate-limit `admin_write` (30 req/min): sirve para escribir, no para
 *   martillar.
 * · Auditoría `RECONCILIACION_HUERFANOS` ya vive en la función; se registra
 *   idéntica corra por el cron o por acá — así el rastro es uno solo.
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
        return NextResponse.json(resumen);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/OPERADORES/RECONCILIACION]");
    }
}
