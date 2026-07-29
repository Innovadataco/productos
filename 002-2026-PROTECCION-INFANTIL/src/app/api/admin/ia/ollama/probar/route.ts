import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOllamaBaseUrl, listOllamaModels, isLocalOllamaUrl } from "@/lib/ai/ollama-config";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario } from "@prisma/client";

export async function POST(request: Request) {
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

        // Fuente única de la URL de Ollama (I-24): el parámetro de sistema
        // system.ollama_base_url / OLLAMA_BASE_URL vía getOllamaBaseUrl.
        // Nunca se sondea una URL enviada por el cliente.
        const url = await getOllamaBaseUrl();
        if (!isLocalOllamaUrl(url)) {
            throw new AppError(
                "los textos de reportes solo pueden procesarse en entorno local/privado (R2)",
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        let models;
        try {
            models = await listOllamaModels(url);
        } catch (ollamaError) {
            // Degradación controlada: un cerebro inalcanzable no es una excepción no controlada.
            logger.error("[IA-OLLAMA-PROBAR] Ollama inalcanzable:", ollamaError);
            return NextResponse.json(
                { ok: false, error: { message: "Ollama inalcanzable", code: ERROR_CODES.SERVICE_UNAVAILABLE } },
                { status: 503 }
            );
        }

        return NextResponse.json({
            ok: true,
            url,
            totalModelos: models.length,
            modelosClasificacion: models.filter((m) => !m.esEmbedding).map((m) => `${m.name}:${m.tag}`),
            modelosEmbedding: models.filter((m) => m.esEmbedding).map((m) => `${m.name}:${m.tag}`),
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[IA-OLLAMA-PROBAR] Error en sondeo de Ollama:", error);
        return NextResponse.json(
            { error: { message: "No se pudo completar el sondeo de Ollama", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
