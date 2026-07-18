import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clasificarConVotos } from "@/lib/ai/classifier";
import { generarEmbedding } from "@/lib/ai/embedder";
import { anonimizarTexto } from "@/lib/ai/anonimizador";
import { detectarPiiCombinado } from "@/lib/ai/pii-detector";
import { detectarDoxing } from "@/lib/ai/pii-patterns";
import { detectarKeywordsRiesgo } from "@/lib/ai/keywords-riesgo";
import { buscarReporteSimilar } from "@/lib/ai/similarity";
import { buscarEjemplosSimilares, type EjemploRecuperado } from "@/lib/ai/dataset-retrieval";
import { requireEnv } from "@/lib/env";
import { ERROR_CODES } from "@/lib/errors";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { recalcularYGuardarScore } from "@/lib/scoring";
import { enviarAlertaRevision, enviarAlertaScoreCritico, enviarAlertasSuscriptores } from "@/lib/email";
import { asignarOperadorAReporte } from "@/lib/operadores/asignador";
import { registrarTransicion } from "@/lib/reporte-transiciones";
import { Prisma } from "@prisma/client";
import type { EstadoReporte } from "@prisma/client";
import { encryptParameter, decryptParameter, isEncryptedValue } from "@/lib/param-encryption";

function esErrorTransitorio(error: unknown): boolean {
    if (error && typeof error === "object" && "retryable" in error && error.retryable === false) {
        return false;
    }
    if (error && typeof error === "object" && "retryable" in error && error.retryable === true) {
        return true;
    }
    const msg = error instanceof Error ? error.message : String(error);
    const patrones = [
        /ollama/i,
        /embedding/i,
        /clasificaci[oó]n/i,
        /anonimiz/i,
        /pii/i,
        /timeout/i,
        /fetch/i,
        /network/i,
        /econnrefused/i,
        /socket/i,
        /abort/i,
        /temporalmente/i,
        /no disponible/i,
    ];
    return patrones.some((p) => p.test(msg));
}

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
        // En reintentos de pg-boss el estado ya puede ser PROCESANDO; evitamos
        // duplicar la transición.
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

        // Generar embedding primero para poder detectar duplicados anónimos
        const paramEmbedding = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.embedding_model" },
        });
        const modeloEmbedding = paramEmbedding?.valor || "nomic-embed-text";
        const vector = await generarEmbedding(modeloEmbedding, reporte.texto);

        // Guardar embedding (necesario para similitud y detección futura)
        const vectorStr = "[" + vector.join(",") + "]";
        const embeddingId = crypto.randomUUID();
        await prisma.$executeRaw`
            INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn")
            VALUES (${embeddingId}, ${reporte.id}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
        `;

        // Recuperar ejemplos corregidos similares para RAG (F5)
        const paramRagTopK = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.classification.rag_top_k" } });
        const ragTopK = parseInt(paramRagTopK?.valor || "3", 10);
        const ejemplosRecuperados = await buscarEjemplosSimilares(vector, { topK: ragTopK });
        const ejemplosRag: EjemploRecuperado[] = ejemplosRecuperados.map((e) => ({
            datasetId: e.datasetId,
            texto: e.texto,
            categoria: e.categoria,
            similitud: e.similitud,
        }));

        // Deduplicación anónima por similitud de embeddings
        if (reporte.esAnonimo) {
            const paramThreshold = await prisma.parametroSistema.findUnique({
                where: { clave: "reportes.duplicate.similarity_threshold" },
            });
            const threshold = parseFloat(paramThreshold?.valor || "0.92");
            const similar = await buscarReporteSimilar(reporte.id, reporte.identificador, reporte.plataformaId, vector, threshold);

            if (similar) {
                await prisma.$transaction(async (tx) => {
                    await registrarTransicion({
                        reporteId: reporteId!,
                        estadoAnterior: "PROCESANDO",
                        estadoNuevo: "DUPLICADO",
                        responsableTipo: "SISTEMA",
                        motivo: "Reporte marcado como duplicado por similitud de embeddings",
                        metadatos: { reporteOrigenId: similar.reporteId },
                        tx,
                    });
                    await tx.reporte.update({
                        where: { id: reporteId! },
                        data: { estado: "DUPLICADO", reporteOrigenId: similar.reporteId },
                    });
                });
                return NextResponse.json({
                    reporteId: reporteId,
                    estado: "DUPLICADO",
                    clasificacion: null,
                    latenciaMs: 0,
                });
            }
        }

        // Modelo de clasificación configurable
        const paramModelo = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.classification_model" },
        });
        const modeloClasificacion = paramModelo?.valor || "ornith:9b";

        // Parámetros de votación F4
        const paramUmbral = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.classification.umbral_revision" },
        });
        const umbralRevision = parseFloat(paramUmbral?.valor || "1.0");

        const paramNVotos = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.classification.n_votos" },
        });
        const nVotos = parseInt(paramNVotos?.valor || "5", 10);

        const paramTemperatura = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.classification.temperatura_votos" },
        });
        const temperaturaVotos = parseFloat(paramTemperatura?.valor || "0.7");

        const paramMinScore = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.classification.min_score_categoria" },
        });
        const minScoreCategoria = parseFloat(paramMinScore?.valor || "0.3");

        const paramParallel = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.classification.ollama_num_parallel" },
        });
        const ollamaNumParallel = parseInt(paramParallel?.valor || process.env.OLLAMA_NUM_PARALLEL || "2", 10);

        const paramModeloDesempate = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.classification.modelo_desempate" },
        });
        const modeloDesempate = paramModeloDesempate?.valor || undefined;

        // Spec 026: umbral para marcar SPAM como POSIBLE_SPAM
        const paramUmbralSpam = await prisma.parametroSistema.findUnique({
            where: { clave: "clasificacion.umbral_spam" },
        });
        const umbralSpam = parseFloat(paramUmbralSpam?.valor || "0.7");

        // F7: parámetros de detección de ráfagas
        const paramRafagaN = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.rafaga.n_reportes" },
        });
        const rafagaN = parseInt(paramRafagaN?.valor || "3", 10);
        const paramRafagaHoras = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.rafaga.ventana_horas" },
        });
        const rafagaHoras = parseInt(paramRafagaHoras?.valor || "24", 10);

        // F7: detectar ráfaga de reportes contra identificador sin historial previo
        let esRafaga = false;
        const ahora = new Date();
        const inicioVentana = new Date(ahora.getTime() - rafagaHoras * 60 * 60 * 1000);
        const historialPrevio = await prisma.reporte.count({
            where: {
                identificador: reporte.identificador,
                plataformaId: reporte.plataformaId,
                eliminado: false,
                creadoEn: { lt: inicioVentana },
            },
        });
        if (historialPrevio === 0) {
            const reportesEnVentana = await prisma.reporte.count({
                where: {
                    identificador: reporte.identificador,
                    plataformaId: reporte.plataformaId,
                    eliminado: false,
                    creadoEn: { gte: inicioVentana, lte: ahora },
                },
            });
            if (reportesEnVentana >= rafagaN) {
                esRafaga = true;
                await prisma.reporte.updateMany({
                    where: {
                        identificador: reporte.identificador,
                        plataformaId: reporte.plataformaId,
                        eliminado: false,
                        creadoEn: { gte: inicioVentana, lte: ahora },
                    },
                    data: { esRafaga: true },
                });
            }
        }

        // Clasificar y detectar PII (F2: separación en paralelo)
        let clasificacion;
        let piiResult: Awaited<ReturnType<typeof detectarPiiCombinado>> | undefined;
        const clasifExistente = await prisma.clasificacionIA.findUnique({
            where: { reporteId: reporte.id },
        });

        const paramAnonModelo = await prisma.parametroSistema.findUnique({
            where: { clave: "reportes.anonymization_model" },
        });
        const modeloAnonimizacion = paramAnonModelo?.valor || modeloClasificacion;

        if (clasifExistente) {
            clasificacion = {
                categoria: clasifExistente.categoria,
                confianza: clasifExistente.confianza,
                categoriasSecundarias: Array.isArray(clasifExistente.categoriasSecundarias) ? clasifExistente.categoriasSecundarias : [],
                posibleAgresorPar: clasifExistente.posibleAgresorPar,
                estado: (clasifExistente.contienePii ? "REQUIERE_ANONIMIZACION" : "CLASIFICADO") as EstadoReporte,
                metrics: { modelo: clasifExistente.modeloUsado, latenciaMs: clasifExistente.latenciaMs },
                rawResponse: clasifExistente.rawResponse,
                votos: Array.isArray(clasifExistente.votos) ? clasifExistente.votos : [],
            };
        } else {
            const [clasifResult, piiResultParallel] = await Promise.all([
                clasificarConVotos(modeloClasificacion, reporte.texto, {
                    nVotos,
                    temperatura: temperaturaVotos,
                    minScoreCategoria,
                    umbralRevision,
                    ollamaNumParallel,
                    ejemplos: ejemplosRag,
                    modeloDesempate,
                    keepAliveDesempate: 0,
                }),
                detectarPiiCombinado(modeloAnonimizacion, reporte.texto),
            ]);

            clasificacion = { ...clasifResult };
            piiResult = piiResultParallel;

            await prisma.clasificacionIA.create({
                data: {
                    reporteId: reporte.id,
                    categoria: clasificacion.categoria,
                    confianza: clasificacion.confianza,
                    contienePii: piiResult.contienePii,
                    piiDetectada: piiResult.piiDetectada,
                    categoriasSecundarias: clasificacion.categoriasSecundarias as unknown as Prisma.InputJsonValue,
                    votos: clasificacion.votos as unknown as Prisma.InputJsonValue,
                    posibleAgresorPar: clasificacion.posibleAgresorPar,
                    usoCascada: clasificacion.usoCascada,
                    modeloCascada: clasificacion.modeloCascada,
                    modeloUsado: clasificacion.metrics.modelo,
                    latenciaMs: clasificacion.metrics.latenciaMs + piiResult.metrics.latenciaMs,
                    promptTokens: clasificacion.metrics.promptTokens,
                    responseTokens: clasificacion.metrics.responseTokens,
                    rawResponse: clasificacion.rawResponse,
                },
            });
        }

function obtenerTextoOriginalPlano(textoOriginalCifrado: string | null, textoActual: string): string {
    if (textoOriginalCifrado && isEncryptedValue(textoOriginalCifrado)) {
        return decryptParameter(textoOriginalCifrado);
    }
    return textoOriginalCifrado ?? textoActual;
}

        // Anonimización automática de PII: preservar original cifrado y reemplazar texto
        let estadoFinal: EstadoReporte = clasificacion.estado;

        // Spec 026: SPAM con confianza suficiente pasa a revisión humana, no se autodestruye
        if (clasificacion.categoria === "SPAM" && clasificacion.confianza >= umbralSpam) {
            estadoFinal = "POSIBLE_SPAM";
        }

        if (piiResult?.contienePii && estadoFinal !== "POSIBLE_SPAM") {
            const originalPlano = obtenerTextoOriginalPlano(reporte.textoOriginal, reporte.texto);
            const anonimizacion = await anonimizarTexto(modeloAnonimizacion, originalPlano, piiResult.piiDetectada);

            let textoOriginalCifrado: string;
            try {
                textoOriginalCifrado = encryptParameter(originalPlano);
            } catch (err) {
                console.error("[PROCESAR] Error cifrando texto original tras anonimización:", err);
                throw new Error("Error de seguridad persistiendo el original anonimizado");
            }

            await prisma.reporte.update({
                where: { id: reporteId },
                data: {
                    textoOriginal: textoOriginalCifrado,
                    texto: anonimizacion.textoAnonimizado,
                },
            });

            // Reflejar PII detectada por el anonimizador en la clasificación
            await prisma.clasificacionIA.update({
                where: { reporteId: reporte.id },
                data: { piiDetectada: anonimizacion.piiDetectada },
            });

            estadoFinal = "CLASIFICADO";
        }

        // Guarda de escalamiento DOXING (R3): la regla determinística nunca reclasifica,
        // solo fuerza revisión manual cuando hay señal de doxing que el LLM no reflejó.
        let prioridadAlta = false;
        let keywordsDetectadas: string[] = [];
        const doxing = detectarDoxing(reporte.texto);
        if (estadoFinal !== "POSIBLE_SPAM" && doxing.esDoxing && clasificacion.categoria !== "DOXING") {
            estadoFinal = "REVISION_MANUAL";
            prioridadAlta = true;
            keywordsDetectadas = doxing.fragmentos.length > 0 ? doxing.fragmentos : ["doxing"];
        }

        // F7: guarda de keywords críticas. Nunca reclasifica; fuerza revisión manual
        // cuando el modelo clasificó como OTRO pero hay señales de riesgo graves.
        const keywordsRiesgo = detectarKeywordsRiesgo(reporte.texto);
        if (
            estadoFinal !== "POSIBLE_SPAM" &&
            keywordsRiesgo.tieneMatch &&
            ((estadoFinal === "CLASIFICADO" && clasificacion.categoria === "OTRO") ||
                estadoFinal === "REVISION_MANUAL")
        ) {
            prioridadAlta = true;
            keywordsDetectadas = Array.from(new Set([...keywordsDetectadas, ...keywordsRiesgo.keywords]));
            if (estadoFinal === "CLASIFICADO" && clasificacion.categoria === "OTRO") {
                estadoFinal = "REVISION_MANUAL";
            }
        }

        // F7: ráfaga fuerza revisión manual con prioridad alta
        if (estadoFinal !== "POSIBLE_SPAM" && esRafaga) {
            estadoFinal = "REVISION_MANUAL";
            prioridadAlta = true;
        }

        // Actualizar estado del reporte a resultado final y registrar transición atómicamente
        await prisma.$transaction(async (tx) => {
            await registrarTransicion({
                reporteId: reporteId!,
                estadoAnterior: "PROCESANDO",
                estadoNuevo: estadoFinal,
                responsableTipo: "IA",
                motivo: estadoFinal === "REVISION_MANUAL" ? "Requiere revisión humana" : "Clasificación automática completada",
                metadatos: {
                    modelo: clasificacion.metrics.modelo,
                    latenciaMs: clasificacion.metrics.latenciaMs,
                    categoria: clasificacion.categoria,
                    confianza: clasificacion.confianza,
                    esRafaga,
                    prioridadAlta,
                },
                tx,
            });
            await tx.reporte.update({
                where: { id: reporteId! },
                data: {
                    estado: estadoFinal,
                    prioridadAlta,
                    keywordsDetectadas,
                    esRafaga,
                },
            });
        });

        // Fase 3: asignación automática de operador para revisión manual o posible spam
        if (estadoFinal === "REVISION_MANUAL" || estadoFinal === "POSIBLE_SPAM") {
            asignarOperadorAReporte(reporteId!).catch((err) =>
                console.error("[OPERADORES] Error asignando operador a reporte", { reporteId, error: err })
            );
        }

        // Actualizar IdentificadorReportado (solo si está clasificado o corregido)
        if (estadoFinal === "CLASIFICADO" || estadoFinal === "CORREGIDO") {
            await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId);
            const scoreResult = await recalcularYGuardarScore(reporte.identificador, reporte.plataformaId);

            if (scoreResult.nivelRiesgo === "CRITICO") {
                enviarAlertaScoreCritico({
                    id: reporte.id,
                    identificador: reporte.identificador,
                    plataformaId: reporte.plataformaId,
                    score: scoreResult.score,
                    nivelRiesgo: scoreResult.nivelRiesgo,
                }).catch((err) => console.error("[ALERTA] Error enviando alerta de score crítico", err));
            }

            // Notificar a usuarios suscritos a alertas para este identificador.
            enviarAlertasSuscriptores({
                identificador: reporte.identificador,
                plataformaId: reporte.plataformaId,
                totalReportes: scoreResult.totalReportes,
            }).catch((err) => console.error("[ALERTA] Error enviando alertas a suscriptores", err));
        }

        // Alertar a administradores cuando el reporte requiere intervención humana
        if (estadoFinal === "REVISION_MANUAL" || estadoFinal === "REQUIERE_ANONIMIZACION" || estadoFinal === "POSIBLE_SPAM") {
            enviarAlertaRevision({
                id: reporte.id,
                numeroSeguimiento: reporte.numeroSeguimiento,
                identificador: reporte.identificador,
                estado: estadoFinal,
                prioridadAlta,
            }).catch((err) => console.error("[ALERTA] Error enviando alerta de revisión", err));
        }

        return NextResponse.json({
            reporteId,
            estado: estadoFinal,
            clasificacion: {
                categoria: clasificacion.categoria,
                confianza: clasificacion.confianza,
                categoriasSecundarias: clasificacion.categoriasSecundarias,
                posibleAgresorPar: clasificacion.posibleAgresorPar,
                votos: clasificacion.votos,
            },
            latenciaMs: clasificacion.metrics.latenciaMs,
        });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const transitorio = esErrorTransitorio(error);

        console.error("[PROCESAR] Error procesando reporte", {
            reporteId: reporteId,
            errorType: error instanceof Error ? error.name : "Unknown",
            errorMessage: errMsg,
            transitorio,
        });

        if (transitorio) {
            return NextResponse.json(
                { error: { message: "Error transitorio procesando el reporte", code: ERROR_CODES.INTERNAL_ERROR, retryable: true } },
                { status: 500 }
            );
        }

        // Errores no transitorios: fallback directo a REVISION_MANUAL
        let reporteParaAlerta: { id: string; numeroSeguimiento: string | null; identificador: string } | null = null;
        if (reporteId) {
            try {
                const reportePrevio = await prisma.reporte.findUnique({
                    where: { id: reporteId },
                    select: { estado: true },
                });
                const estadoPrevio = reportePrevio?.estado ?? "PENDIENTE";

                const reporteActualizado = await prisma.$transaction(async (tx) => {
                    await registrarTransicion({
                        reporteId: reporteId!,
                        estadoAnterior: estadoPrevio,
                        estadoNuevo: "REVISION_MANUAL",
                        responsableTipo: "SISTEMA",
                        motivo: `Error de procesamiento: ${errMsg}`,
                        metadatos: { error: errMsg },
                        tx,
                    });
                    return tx.reporte.update({
                        where: { id: reporteId! },
                        data: {
                            estado: "REVISION_MANUAL",
                            processingError: errMsg,
                        },
                    });
                });
                reporteParaAlerta = {
                    id: reporteActualizado.id,
                    numeroSeguimiento: reporteActualizado.numeroSeguimiento,
                    identificador: reporteActualizado.identificador,
                };

                asignarOperadorAReporte(reporteId!).catch((err) =>
                    console.error("[OPERADORES] Error asignando operador a reporte con error", { reporteId: reporteId, error: err })
                );
            } catch {
                // Si falla el update del error, solo loggear
            }
        }

        if (reporteParaAlerta) {
            enviarAlertaRevision({
                id: reporteParaAlerta.id,
                numeroSeguimiento: reporteParaAlerta.numeroSeguimiento,
                identificador: reporteParaAlerta.identificador,
                estado: "REVISION_MANUAL",
            }).catch((err) => console.error("[ALERTA] Error enviando alerta de revisión", err));
        }

        return NextResponse.json(
            { error: { message: "Error procesando el reporte", code: ERROR_CODES.INTERNAL_ERROR, retryable: false } },
            { status: 500 }
        );
    }
}
