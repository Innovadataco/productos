import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clasificarReporte } from "@/lib/ai/classifier";
import { generarEmbedding } from "@/lib/ai/embedder";
import { requireEnv } from "@/lib/env";
import { ERROR_CODES } from "@/lib/errors";

export async function POST(request: Request) {
    try {
        const secret = request.headers.get("x-worker-secret");
        if (secret !== requireEnv("WORKER_SECRET", 8)) {
            return NextResponse.json(
                { error: { message: "Unauthorized", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { reporteId } = await request.json();

        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
        });
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // Idempotencia: si ya no está pendiente/procesando, o ya tiene clasificación
        const clasifExistente = await prisma.clasificacionIA.findUnique({
            where: { reporteId: reporte.id },
        });
        if (clasifExistente) {
            return NextResponse.json({
                reporteId,
                estado: reporte.estado,
                clasificacion: {
                    categoria: clasifExistente.categoria,
                    confianza: clasifExistente.confianza,
                },
                latenciaMs: 0,
            });
        }

        if (reporte.estado !== "PENDIENTE" && reporte.estado !== "PROCESANDO") {
            const clasif = await prisma.clasificacionIA.findUnique({
                where: { reporteId: reporte.id },
            });
            return NextResponse.json({
                reporteId,
                estado: reporte.estado,
                clasificacion: clasif ? {
                    categoria: clasif.categoria,
                    confianza: clasif.confianza,
                } : null,
                latenciaMs: 0,
            });
        }

        // Actualizar estado a PROCESANDO
        await prisma.reporte.update({
            where: { id: reporteId },
            data: { estado: "PROCESANDO" },
        });

        // Obtener modelo de clasificación desde parámetros
        const paramModelo = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.classification_model" },
        });
        const modeloClasificacion = paramModelo?.valor || "ornith:9b";

        // Clasificar
        const clasificacion = await clasificarReporte(modeloClasificacion, reporte.texto);

        // Guardar clasificación
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: clasificacion.categoria,
                confianza: clasificacion.confianza,
                contienePii: clasificacion.contienePii,
                piiDetectada: clasificacion.piiDetectada,
                modeloUsado: clasificacion.metrics.modelo,
                latenciaMs: clasificacion.metrics.latenciaMs,
                promptTokens: clasificacion.metrics.promptTokens,
                responseTokens: clasificacion.metrics.responseTokens,
                rawResponse: clasificacion.rawResponse,
            },
        });

        // Generar embedding (best-effort, no debe bloquear el flujo)
        try {
            const paramEmbedding = await prisma.parametroSistema.findUnique({
                where: { clave: "reportes.embedding_model" },
            });
            const modeloEmbedding = paramEmbedding?.valor || "nomic-embed-text";
            const vector = await generarEmbedding(modeloEmbedding, reporte.texto);

            const vectorStr = "[" + vector.join(",") + "]";
            await prisma.$executeRawUnsafe(
                `INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn") VALUES ('${crypto.randomUUID()}', '${reporte.id}', '${vectorStr}'::vector, '${modeloEmbedding}', NOW())`
            );
        } catch (embedErr) {
            const msg = embedErr instanceof Error ? embedErr.message : String(embedErr);
            console.error("[PROCESAR] Embedding falló (no crítico):", msg);
        }

        // Actualizar estado del reporte (SIEMPRE, para evitar quedar atascado en PROCESANDO)
        await prisma.reporte.update({
            where: { id: reporteId },
            data: { estado: clasificacion.estado },
        });

        // Actualizar IdentificadorReportado (solo si está clasificado o requiere anonimización)
        if (clasificacion.estado === "CLASIFICADO" || clasificacion.estado === "CORREGIDO") {
            await actualizarVisibilidad(reporte.identificador, reporte.plataformaId);
        }

        return NextResponse.json({
            reporteId,
            estado: clasificacion.estado,
            clasificacion: {
                categoria: clasificacion.categoria,
                confianza: clasificacion.confianza,
            },
            latenciaMs: clasificacion.metrics.latenciaMs,
        });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("[PROCESAR] Error:", errMsg);
        return NextResponse.json(
            { error: { message: "Error en procesamiento", code: ERROR_CODES.INTERNAL_ERROR, retryable: true } },
            { status: 500 }
        );
    }
}

async function actualizarVisibilidad(identificador: string, plataformaId: string) {
    const paramUmbral = await prisma.parametroSistema.findUnique({
        where: { clave: "visibility.report_threshold" },
    });
    const paramRatio = await prisma.parametroSistema.findUnique({
        where: { clave: "visibility.min_authenticated_ratio" },
    });

    const umbral = parseInt(paramUmbral?.valor || "3", 10);
    const minRatio = parseFloat(paramRatio?.valor || "0.5");

    const agregado = await prisma.identificadorReportado.findUnique({
        where: { identificador_plataformaId: { identificador, plataformaId } },
    });

    if (!agregado) return;

    const ratioAutenticados = agregado.totalReportes > 0
        ? agregado.reportesAutenticados / agregado.totalReportes
        : 0;

    const esVisible = agregado.totalReportes >= umbral && ratioAutenticados >= minRatio;

    await prisma.identificadorReportado.update({
        where: { id: agregado.id },
        data: { esVisiblePublicamente: esVisible },
    });
}