import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clasificarReporte } from "@/lib/ai/classifier";
import { generarEmbedding } from "@/lib/ai/embedder";
import { anonimizarTexto } from "@/lib/ai/anonimizador";
import { requireEnv } from "@/lib/env";
import { ERROR_CODES } from "@/lib/errors";
import type { EstadoReporte } from "@prisma/client";

const ESTADOS_FINALES = new Set([
    "CLASIFICADO",
    "CORREGIDO",
    "DUPLICADO",
    "POSIBLE_SPAM",
    "REVISION_MANUAL",
    "REQUIERE_ANONIMIZACION",
]);

export async function POST(request: Request) {
    let reporteId: string | undefined;
    try {
        const secret = request.headers.get("x-worker-secret");
        if (secret !== requireEnv("WORKER_SECRET", 8)) {
            return NextResponse.json(
                { error: { message: "Unauthorized", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const body = (await request.json()) as { reporteId?: string };
        reporteId = body.reporteId;
        if (!reporteId) {
            return NextResponse.json(
                { error: { message: "reporteId requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
        });
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // Idempotencia: si ya está en estado final, no reprocesar
        if (ESTADOS_FINALES.has(reporte.estado)) {
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

        // Clasificar (solo si no existe clasificación previa — idempotencia parcial)
        let clasificacion;
        const clasifExistente = await prisma.clasificacionIA.findUnique({
            where: { reporteId: reporte.id },
        });

        if (clasifExistente) {
            clasificacion = {
                categoria: clasifExistente.categoria,
                confianza: clasifExistente.confianza,
                estado: (clasifExistente.contienePii ? "REQUIERE_ANONIMIZACION" : "CLASIFICADO") as EstadoReporte,
                contienePii: clasifExistente.contienePii,
                piiDetectada: clasifExistente.piiDetectada,
                metrics: { modelo: clasifExistente.modeloUsado, latenciaMs: clasifExistente.latenciaMs },
                rawResponse: clasifExistente.rawResponse,
            };
        } else {
            clasificacion = await clasificarReporte(modeloClasificacion, reporte.texto);
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
        }

        // Anonimización automática de PII: preservar original y reemplazar texto
        let textoParaEmbedding = reporte.texto;
        let estadoFinal: EstadoReporte = clasificacion.estado;

        if (clasificacion.contienePii) {
            const textoAAnonimizar = reporte.textoOriginal ?? reporte.texto;
            const anonimizacion = await anonimizarTexto(modeloClasificacion, textoAAnonimizar);

            await prisma.reporte.update({
                where: { id: reporteId },
                data: {
                    textoOriginal: textoAAnonimizar,
                    texto: anonimizacion.textoAnonimizado,
                },
            });

            // Reflejar PII detectada por el anonimizador en la clasificación
            await prisma.clasificacionIA.update({
                where: { reporteId: reporte.id },
                data: { piiDetectada: anonimizacion.piiDetectada },
            });

            textoParaEmbedding = anonimizacion.textoAnonimizado;
            estadoFinal = "CLASIFICADO";
        }

        // Generar embedding (obligatorio — si falla, el job se reintenta)
        const paramEmbedding = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.embedding_model" },
        });
        const modeloEmbedding = paramEmbedding?.valor || "nomic-embed-text";
        const vector = await generarEmbedding(modeloEmbedding, textoParaEmbedding);

        const vectorStr = "[" + vector.join(",") + "]";
        const embeddingId = crypto.randomUUID();
        await prisma.$executeRaw`
            INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn")
            VALUES (${embeddingId}, ${reporte.id}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
        `;

        // Actualizar estado del reporte a resultado final
        await prisma.reporte.update({
            where: { id: reporteId },
            data: { estado: estadoFinal },
        });

        // Actualizar IdentificadorReportado (solo si está clasificado o corregido)
        if (estadoFinal === "CLASIFICADO" || estadoFinal === "CORREGIDO") {
            await actualizarVisibilidad(reporte.identificador, reporte.plataformaId);
        }

        return NextResponse.json({
            reporteId,
            estado: estadoFinal,
            clasificacion: {
                categoria: clasificacion.categoria,
                confianza: clasificacion.confianza,
            },
            latenciaMs: clasificacion.metrics.latenciaMs,
        });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);

        // Guardar error de procesamiento en el reporte
        if (reporteId) {
            try {
                await prisma.reporte.update({
                    where: { id: reporteId },
                    data: {
                        estado: "REVISION_MANUAL",
                        processingError: errMsg,
                    },
                });
            } catch {
                // Si falla el update del error, solo loggear
            }
        }

        console.error("[PROCESAR] Error:", errMsg);
        return NextResponse.json(
            { error: { message: errMsg, code: ERROR_CODES.INTERNAL_ERROR, retryable: true } },
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