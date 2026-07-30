/**
 * SPEC-053 (FR-004, US1): ReporteProcessingService — orquestación del pipeline
 * de IA del reporte (seguridad, duplicados, ráfagas, clasificación, embedding,
 * anonimización, finalización), movida desde `api/reportes/procesar/route.ts`.
 * Las transacciones usan `withUnitOfWork` con repositorios que comparten la
 * misma tx (D2); el embedding pgvector vive en `EmbeddingRepository` (D3).
 * Los helpers del pipeline viven en este mismo directorio (movidos desde
 * `api/reportes/procesar/helpers/` sin cambios de comportamiento).
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { generarEmbedding } from "@/lib/ai/embedder";
import { buscarEjemplosSimilares, type EjemploRecuperado } from "@/lib/ai/dataset-retrieval";
import { registrarPaso } from "@/lib/expediente/pasos";
import { verificarWorkerSecret } from "@/lib/worker-auth";
import { withUnitOfWork } from "../../unit-of-work";
import { ReporteRepository } from "../../repositories/reporte";
import { ClasificacionIARepository } from "../../repositories/clasificacion-ia";
import { EmbeddingRepository } from "../../repositories/embedding";
import { TransicionReporteRepository } from "../../repositories/transicion-reporte";
import { esErrorTransitorio, ESTADOS_FINALES, respuestaTransitoria, respuestaErrorProcesamiento } from "./errors";
import { parsearBody, obtenerReporte } from "./seguridad";
import { detectarDuplicado } from "./duplicados";
import { cargarParametrosClasificacion } from "./parametros";
import { detectarRafaga } from "./rafagas";
import { clasificarReporte } from "./clasificacion";
import { anonimizarReporte } from "./anonimizacion";
import { aplicarGuardasSeguridad } from "./guardas";
import { aplicarGuardasPrevias } from "./guardas-previas";
import {
    finalizarReporte,
    respuestaExito,
    fallbackARevisionManual,
    enviarAlertaRevisionManual,
    obtenerErrorCode,
} from "./finalizacion";

export async function procesarReporte(request: Request): Promise<NextResponse> {
    let reporteId: string | undefined;
    try {
        const secretResult = verificarWorkerSecret(request);
        if (!secretResult.ok) return secretResult.response;

        const bodyResult = await parsearBody(request);
        if (!bodyResult.ok) return bodyResult.response;
        reporteId = bodyResult.reporteId;

        const reporteResult = await obtenerReporte(reporteId);
        if (!reporteResult.ok) return reporteResult.response;
        const reporte = reporteResult.reporte;
        const modeloClasificacion = bodyResult.modeloClasificacion;

        // Idempotencia: si ya está en estado final, no reprocesar
        if (ESTADOS_FINALES.has(reporte.estado)) {
            const clasif = await new ClasificacionIARepository().findByReporteId(reporte.id);
            return NextResponse.json({
                reporteId,
                estado: reporte.estado,
                clasificacion: clasif
                    ? {
                          categoria: clasif.categoria,
                          confianza: clasif.confianza,
                          posibleAgresorPar: clasif.posibleAgresorPar,
                      }
                    : null,
                latenciaMs: 0,
            });
        }

        const estadoAnteriorReporte = reporte.estado;

        // Actualizar estado a PROCESANDO y registrar transición atómicamente
        // (UNA unidad de trabajo compartida por los repositorios, D2).
        if (estadoAnteriorReporte !== "PROCESANDO") {
            await withUnitOfWork(async (tx) => {
                await new TransicionReporteRepository(tx).registrar({
                    reporteId: reporteId!,
                    estadoAnterior: estadoAnteriorReporte,
                    estadoNuevo: "PROCESANDO",
                    responsableTipo: "WORKER",
                    motivo: "Inicio de procesamiento por worker",
                });
                await new ReporteRepository(tx).actualizarEstado(reporteId!, { estado: "PROCESANDO" });
            });
        }

        // Generar embedding (la raw query pgvector vive en EmbeddingRepository, D3)
        const parametros = await cargarParametrosClasificacion(modeloClasificacion ? { modeloClasificacion } : undefined);
        const vector = await generarEmbedding(parametros.modeloEmbedding, reporte.texto);
        await new EmbeddingRepository().insertReporteEmbedding(reporte.id, parametros.modeloEmbedding, vector);

        // Spec 092-US4: deduplicación ANTES del RAG (si es duplicado, el RAG no se gasta)
        const duplicado = await detectarDuplicado({
            reporteId: reporte.id,
            identificador: reporte.identificador,
            plataformaId: reporte.plataformaId,
            vector,
            esAnonimo: reporte.esAnonimo,
        });
        if (duplicado.esDuplicado) return duplicado.response;

        // Spec 092-US4: GUARDAS PREVIAS baratas (solo texto/frecuencia) — si disparan,
        // CORTAN a revisión SIN gastar los modelos de clasificación.
        const esRafaga = await detectarRafaga({
            reporteId: reporte.id,
            identificador: reporte.identificador,
            plataformaId: reporte.plataformaId,
            rafagaN: parametros.rafagaN,
            rafagaHoras: parametros.rafagaHoras,
        });
        const guardaPrevia = aplicarGuardasPrevias({ reporteId: reporte.id, texto: reporte.texto, esRafaga });
        if (guardaPrevia.cortar) {
            const estadoCorte = await finalizarReporte({
                reporteId: reporte.id,
                estadoFinal: "REVISION_MANUAL",
                clasificacion: {
                    categoria: "OTRO",
                    confianza: 0,
                    categoriasSecundarias: [],
                    posibleAgresorPar: false,
                    estado: "REVISION_MANUAL",
                    metrics: { modelo: "guardas-previas", latenciaMs: 0 },
                    rawResponse: JSON.stringify({ motivo: guardaPrevia.motivo }),
                    votos: [],
                },
                esRafaga,
                prioridadAlta: guardaPrevia.prioridadAlta,
                keywordsDetectadas: guardaPrevia.keywordsDetectadas,
            });
            return NextResponse.json({ reporteId: reporte.id, estado: estadoCorte, clasificacion: null, corteGuardaPrevia: true });
        }

        // Recuperar ejemplos corregidos similares para RAG (después de dedup)
        const ragTopK = parametros.ragTopK ?? 3;
        const ejemplosRecuperados = await buscarEjemplosSimilares(vector, { topK: ragTopK });
        const ejemplosRag: EjemploRecuperado[] = ejemplosRecuperados.map((e) => ({
            datasetId: e.datasetId,
            texto: e.texto,
            categoria: e.categoria,
            similitud: e.similitud,
        }));

        // Spec 096-US3: traza del contexto RAG (sin textos, solo referencias y scores).
        await registrarPaso(reporte.id, "contexto_rag", {
            veredicto: ejemplosRag.length > 0 ? "casos_recuperados" : "sin_casos",
            detalle: {
                casosSimilares: ejemplosRag.map((e) => ({
                    datasetId: e.datasetId,
                    categoria: e.categoria,
                    similitud: e.similitud,
                })),
                categoriasVecinas: Array.from(new Set(ejemplosRag.map((e) => e.categoria))),
                topK: ragTopK,
            },
        });

        // Clasificar y detectar PII
        const { clasificacion, piiResult } = await clasificarReporte({
            reporteId: reporte.id,
            texto: reporte.texto,
            parametros,
            ejemplosRag,
        });

        let estadoFinal = clasificacion.estado;

        // Anonimización automática de PII
        if (piiResult?.contienePii && estadoFinal !== "POSIBLE_SPAM") {
            const resultado = await anonimizarReporte({
                reporteId: reporte.id,
                textoActual: reporte.texto,
                textoOriginalCifrado: reporte.textoOriginal,
                piiDetectada: piiResult.piiDetectada,
                modeloAnonimizacion: parametros.modeloAnonimizacion,
            });
            estadoFinal = resultado.estadoFinal;
        }

        // Aplicar guardas de seguridad
        const guardas = aplicarGuardasSeguridad({
            reporteId: reporte.id,
            texto: reporte.texto,
            clasificacion,
            estadoInicial: estadoFinal,
            esRafaga,
            umbralSpam: parametros.umbralSpam,
        });
        estadoFinal = guardas.estadoFinal;

        // Finalizar reporte y alertas
        estadoFinal = await finalizarReporte({
            reporteId: reporte.id,
            estadoFinal,
            clasificacion,
            esRafaga,
            prioridadAlta: guardas.prioridadAlta,
            keywordsDetectadas: guardas.keywordsDetectadas,
        });

        // I-06: si el reporte pertenece a una simulación, actualizar su progreso (fail-open).
        const { marcarProgresoSimulacionPorReporte } = await import("@/lib/simulacion/progreso");
        await marcarProgresoSimulacionPorReporte(reporte.id);

        return respuestaExito({ reporteId: reporte.id, estadoFinal, clasificacion });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const errorCode = obtenerErrorCode(error);
        const transitorio = esErrorTransitorio(error);

        logger.error("[PROCESAR] Error procesando reporte", {
            reporteId,
            errorType: error instanceof Error ? error.name : "Unknown",
            errorMessage: errMsg,
            transitorio,
        });

        if (transitorio) {
            return respuestaTransitoria();
        }

        if (reporteId) {
            const reporteParaAlerta = await fallbackARevisionManual({ reporteId, errorCode });
            if (reporteParaAlerta) {
                await enviarAlertaRevisionManual({ reporteParaAlerta });
            }
        }

        return respuestaErrorProcesamiento(errorCode);
    }
}
