import { NextResponse } from "next/server";

/**
 * Healthcheck público mínimo para Docker (D1) — sin datos sensibles.
 * Los chequeos detallados (réplica, MVs, Ollama) irán detrás de sesión
 * o de CRON_SECRET en Fase 2.
 */
export async function GET() {
    return NextResponse.json({
        ok: true,
        servicio: "bi-006",
        fase: "1a-validacion-infra",
        hora: new Date().toISOString(),
    });
}
