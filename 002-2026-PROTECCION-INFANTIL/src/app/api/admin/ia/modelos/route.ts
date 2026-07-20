import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { listOllamaModels } from "@/lib/ai/ollama-config";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { RolUsuario } from "@prisma/client";

export async function GET(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const models = await listOllamaModels();
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
