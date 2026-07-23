import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { listOllamaModels, isLocalOllamaUrl } from "@/lib/ai/ollama-config";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { withValidation } from "@/lib/validation";
import { ollamaProbarBodySchema } from "@/lib/schemas";
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

        const { url } = await withValidation.body(ollamaProbarBodySchema)(request);
        if (!isLocalOllamaUrl(url)) {
            throw new AppError(
                "los textos de reportes solo pueden procesarse en entorno local/privado (R2)",
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        const models = await listOllamaModels(url);
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
        console.error("[IA-OLLAMA-PROBAR] Error conectando con Ollama:", error);
        return NextResponse.json(
            { error: { message: "No se pudo conectar con Ollama", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
