/**
 * SPEC-302 (002-PI-208 · R-022 §1.3 punto a): señal de monitoreo del motor de
 * notificaciones. Sin auth, igual que /api/health — consumido por
 * scripts/monitor-probes.mjs, no expone datos personales (solo un conteo).
 */
import { NextResponse } from "next/server";
import { contarPendientesVencidas } from "@/lib/notificaciones/metricas";
import { ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";

const UMBRAL_MINUTOS = 15;

export async function GET() {
    try {
        const notifPendientesVencidas = await contarPendientesVencidas(UMBRAL_MINUTOS);
        return NextResponse.json({
            notif_pendientes_vencidas: notifPendientesVencidas,
            umbral_minutos: UMBRAL_MINUTOS,
            estado: notifPendientesVencidas > 0 ? "🔴 worker posiblemente atascado" : "🟢",
        });
    } catch (error) {
        logger.error("[MONITOR-NOTIF] Error calculando pendientes vencidas:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
