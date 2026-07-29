import { NextResponse } from "next/server";
import { requireEnv } from "./env";
import { ERROR_CODES } from "./errors";

/**
 * ÚNICA verificación del secreto del worker (SPEC-125, bloque R6).
 * Los endpoints que solo consume el worker (`/api/reportes/procesar`,
 * `/api/reportes/fallback`) DEBEN pasar por aquí; no duplicar la comparación.
 */
export function verificarWorkerSecret(request: Request): { ok: true } | { ok: false; response: NextResponse } {
    const secret = request.headers.get("x-worker-secret");
    if (secret !== requireEnv("WORKER_SECRET", 8)) {
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
