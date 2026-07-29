import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { listOllamaModels } from "@/lib/ai/ollama-config";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { RolUsuario } from "@prisma/client";

export async function GET(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_configuracion");

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        // Degradación controlada (mismo patrón que el sondeo de I-24 en
        // /api/admin/ia/ollama/probar): un cerebro inalcanzable no es un 500 —
        // el Centro de Control recibe 503 con error estructurado.
        let models;
        try {
            models = await listOllamaModels();
        } catch (ollamaError) {
            console.error("[IA-MODELOS] Ollama inalcanzable:", ollamaError);
            return NextResponse.json(
                { ok: false, error: { message: "Ollama inalcanzable", code: ERROR_CODES.SERVICE_UNAVAILABLE } },
                { status: 503 }
            );
        }
        return NextResponse.json({ models });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[IA-MODELOS] Error listando modelos:", error);
        return NextResponse.json(
            { error: { message: "No se pudieron listar los modelos de Ollama", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
