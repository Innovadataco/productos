import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generarEmbedding } from "@/lib/ai/embedder";
import { buscarEjemplosSimilares, type EjemploRecuperado } from "@/lib/ai/dataset-retrieval";
import { registrarTransicion } from "@/lib/reporte-transiciones";
import { esErrorTransitorio, ESTADOS_FINALES, respuestaTransitoria, respuestaErrorProcesamiento } from "./helpers/errors";
import { validarWorkerSecret, parsearBody, obtenerReporte } from "./helpers/seguridad";
import { guardarEmbedding } from "./helpers/embedding";
import { detectarDuplicado } from "./helpers/duplicados";
import { cargarParametrosClasificacion } from "./helpers/parametros";
import { detectarRafaga } from "./helpers/rafagas";
import { clasificarReporte } from "./helpers/clasificacion";
import { anonimizarReporte } from "./helpers/anonimizacion";
import { aplicarGuardasSeguridad } from "./helpers/guardas";
import { aplicarGuardasPrevias } from "./helpers/guardas-previas";
import {
    finalizarReporte,
    respuestaExito,
    fallbackARevisionManual,
    enviarAlertaRevisionManual,
    obtenerErrorCode,
} from "./helpers/finalizacion";

export async function POST(request: Request) {
    let reporteId: string | undefined;
    try {
        const secretResult = validarWorkerSecret(request);
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
            const clasif = await prisma.clasificacionIA.findUnique({
                where: { reporteId: reporte.id },
            });
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

        // Actualizar estado a PROCESANDO y registrar transición atómicamente.
        if (estadoAnteriorReporte !== "PROCESANDO") {
            await prisma.$transaction(async (tx) => {
                await registrarTransicion({
                    reporteId: reporteId!,
                    estadoAnterior: estadoAnteriorReporte,
                    estadoNuevo: "PROCESANDO",
                    responsableTipo: "WORKER",
                    motivo: "Inicio de procesamiento por worker",
                    tx,
                });
                await tx.reporte.update({
                    where: { id: reporteId! },
                    data: { estado: "PROCESANDO" },
                });
            });
        }

        // Generar embedding
        const parametros = await cargarParametrosClasificacion(modeloClasificacion ? { modeloClasificacion } : undefined);
        const vector = await generarEmbedding(parametros.modeloEmbedding, reporte.texto);
        await guardarEmbedding(reporte.id, parametros.modeloEmbedding, vector);

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
            identificador: reporte.identificador,
            plataformaId: reporte.plataformaId,
            rafagaN: parametros.rafagaN,
            rafagaHoras: parametros.rafagaHoras,
        });
        const guardaPrevia = aplicarGuardasPrevias({ texto: reporte.texto, esRafaga });
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

        console.error("[PROCESAR] Error procesando reporte", {
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
