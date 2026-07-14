import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { generarEmbedding } from "@/lib/ai/embedder";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";

const anonimizarSchema = z.object({
    textoAnonimizado: z.string().min(20).max(5000),
});

function requireAdmin(user: { rol: string }) {
    if (String(user.rol) !== "ADMIN") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        requireAdmin(user);

        const { id: reporteId } = await params;

        const body = await request.json();
        const parsed = anonimizarSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { textoAnonimizado } = parsed.data;

        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            include: { clasificacion: true, embedding: true },
        });
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (reporte.estado !== "REQUIERE_ANONIMIZACION") {
            return NextResponse.json(
                { error: { message: "El reporte no requiere anonimización", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const piiEliminada = reporte.clasificacion?.piiDetectada || [];

        // Transacción: preservar original, actualizar texto y estado
        await prisma.$transaction(async (tx) => {
            await tx.reporte.update({
                where: { id: reporteId },
                data: {
                    textoOriginal: reporte.texto,
                    texto: textoAnonimizado,
                    estado: "CLASIFICADO",
                },
            });
        });

        // Regenerar embedding sobre texto anonimizado (best-effort)
        try {
            const paramEmbedding = await prisma.parametroSistema.findUnique({
                where: { clave: "reportes.embedding_model" },
            });
            const modeloEmbedding = paramEmbedding?.valor || "nomic-embed-text";
            const vector = await generarEmbedding(modeloEmbedding, textoAnonimizado);

            const vectorStr = "[" + vector.join(",") + "]";
            if (reporte.embedding) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "EmbeddingReporte" SET vector = '${vectorStr}'::vector, "modeloUsado" = '${modeloEmbedding}' WHERE "reporteId" = '${reporteId}'`
                );
            } else {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn") VALUES ('${crypto.randomUUID()}', '${reporteId}', '${vectorStr}'::vector, '${modeloEmbedding}', NOW())`
                );
            }
        } catch (embedErr) {
            const msg = embedErr instanceof Error ? embedErr.message : String(embedErr);
            console.error("[ANONIMIZAR] Embedding falló (no crítico):", msg);
            // No fallamos la anonimización; el embedding se puede regenerar después
        }

        return NextResponse.json({
            reporteId,
            estadoAnterior: "REQUIERE_ANONIMIZACION",
            estadoNuevo: "CLASIFICADO",
            textoAnonimizado,
            piiEliminada,
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