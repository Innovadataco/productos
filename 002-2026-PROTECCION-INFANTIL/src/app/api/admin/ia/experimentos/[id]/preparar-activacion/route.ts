import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { withValidation } from "@/lib/validation";
import { operadorIdParamsSchema } from "@/lib/schemas";
import { IaEvalsService } from "@/lib/dal/services/ia-evals";
import { RolUsuario } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_eval");
        const { id } = withValidation.params(operadorIdParamsSchema)(await context.params);

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        // SPEC-053: validación del experimento y su snapshot viven en el DAL.
        const snapshot = await new IaEvalsService().obtenerSnapshotActivacion(id);

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
            mensaje: "Configuración precargada. Guarde los cambios en la pestaña Configuración para activarlos.",
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
