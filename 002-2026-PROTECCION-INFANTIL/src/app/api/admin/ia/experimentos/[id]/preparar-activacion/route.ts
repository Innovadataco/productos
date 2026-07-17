import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario } from "@prisma/client";
import { type ExperimentConfigSnapshot } from "@/lib/ai/eval-runner";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        const { id } = await context.params;

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const run = await prisma.evalRun.findUnique({ where: { id } });
        if (!run) {
            throw new AppError("Experimento no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (run.estado !== "COMPLETADA") {
            throw new AppError("El experimento debe estar completado", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const snapshot = run.configSnapshot as unknown as ExperimentConfigSnapshot | null;
        if (!snapshot) {
            throw new AppError("El experimento no tiene configSnapshot", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        return NextResponse.json({
            parametros: {
                "reportes.classification_model": snapshot.modeloClasificacion,
                "reportes.embedding_model": snapshot.modeloEmbedding,
                "reportes.classification.umbral_revision": String(snapshot.umbralRevision),
                "reportes.classification.n_votos": String(snapshot.nVotos),
                "reportes.classification.temperatura_votos": String(snapshot.temperaturaVotos),
                "reportes.classification.rag_top_k": String(snapshot.ragTopK),
                "system.ollama_base_url": snapshot.ollamaBaseUrl,
            },
            mensaje: "Configuración precargada. Guardá los cambios en la pestaña Configuración para activarlos.",
        });
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
