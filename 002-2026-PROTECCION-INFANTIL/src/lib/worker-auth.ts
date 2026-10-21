import { NextResponse } from "next/server";
import { requireEnv } from "./env";
import { ERROR_CODES } from "./errors";
import { comparacionSecretoConstante } from "./timing-safe";

/**
 * ÚNICA verificación del secreto del worker (SPEC-125, bloque R6).
 * Los endpoints que solo consume el worker (`/api/reportes/procesar`,
 * `/api/reportes/fallback`) DEBEN pasar por aquí; no duplicar la comparación.
 *
 * SPEC-898: la comparación es CONSTANTE en tiempo (`comparacionSecretoConstante`); el `!==`
 * de string anterior filtraba el secreto por timing (era la única ruta del repo con esa
 * desviación; el webhook de Resend y el simulador ya usaban `timingSafeEqual`).
 */
export function verificarWorkerSecret(request: Request): { ok: true } | { ok: false; response: NextResponse } {
    const recibido = request.headers.get("x-worker-secret");
    if (!comparacionSecretoConstante(recibido, requireEnv("WORKER_SECRET", 8))) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: { message: "Unauthorized", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            ),
        };
    }
    return { ok: true };
}
