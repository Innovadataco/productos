import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { MonitoreoRepository } from "@/lib/dal/repositories/monitoreo";
import { SENALES_MONITOREO } from "@/lib/monitoreo/probes";

/**
 * GET /api/admin/monitoreo/historial?senal=ollama_smoke&limite=50 (SPEC-186)
 * Historial de probes de una señal + resumen de Ollama en las últimas 24h.
 * Solo lectura; sin datos de reportes.
 */
export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "estadisticas");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const senal = searchParams.get("senal") ?? "";
        const limiteRaw = searchParams.get("limite") ?? "50";
        const limite = Math.min(100, Math.max(1, Number(limiteRaw) || 50));

        if (!SENALES_MONITOREO.includes(senal as (typeof SENALES_MONITOREO)[number])) {
            throw new AppError("Señal no válida", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const repo = new MonitoreoRepository();
        const [items, resumen24h] = await Promise.all([
            repo.historialProbes(senal, limite),
            senal.startsWith("ollama") ? repo.resumenOllamaUltimas24h() : null,
        ]);

        return NextResponse.json({ items, resumen24h });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
