import { prisma } from "@/lib/prisma";
import { getParametroSistema } from "@/lib/parametros";
import { generarEmbedding } from "./embedder";
import { buscarEjemplosSimilares, type EjemploRecuperado } from "./dataset-retrieval";
import { clasificarConVotos, type ClassificationResult, type VotoIndividual } from "./classifier";
import { detectarPiiCombinado, type PiiDetectionResult } from "./pii-detector";
import { detectarDoxing } from "./pii-patterns";
import { detectarKeywordsRiesgo } from "./keywords-riesgo";
import { anonimizarTexto, type AnonimizacionResult } from "./anonimizador";
import type { CategoriaConducta } from "@prisma/client";

export interface SandboxOverrides {
    umbral_revision?: number;
    n_votos?: number;
    temperatura_votos?: number;
    min_score_categoria?: number;
    rag_top_k?: number;
    modelo_clasificacion?: string;
}

export interface SandboxParametros {
    modeloClasificacion: string;
    embeddingModel: string;
    anonymizationModel: string;
    umbralRevision: number;
    nVotos: number;
    temperatura: number;
    minScoreCategoria: number;
    ragTopK: number;
    ollamaNumParallel: number;
}

export interface SandboxVotoDistribucion {
    categoria: CategoriaConducta;
    count: number;
}

export interface SandboxTrace {
    texto: string;
    parametrosEfectivos: SandboxParametros;
    etapas: {
        embedding: {
            latenciaMs: number;
            modelo: string;
        };
        rag: {
            latenciaMs: number;
            topK: number;
            ejemplos: EjemploRecuperado[];
        };
        votacion: {
            latenciaMs: number;
            votos: VotoIndividual[];
            distribucion: SandboxVotoDistribucion[];
            categoria: CategoriaConducta;
            confianza: number;
            categoriasSecundarias: { categoria: CategoriaConducta; score: number }[];
            posibleAgresorPar: boolean;
            estado: string;
        };
        pii: {
            latenciaMs: number;
            contienePii: boolean;
            piiDetectada: string[];
        };
        anonimizacion?: {
            latenciaMs: number;
            textoAnonimizado: string;
            piiDetectada: string[];
        };
        guardas: {
            latenciaMs: number;
            doxing: { esDoxing: boolean; fragmentos: string[] };
            keywords: { tieneMatch: boolean; keywords: string[] };
            rafaga: { esRafaga: false; razon: string };
            prioridadAlta: boolean;
            keywordsDetectadas: string[];
            estadoForzado?: string;
        };
    };
    decision: {
        categoria: CategoriaConducta;
        confianza: number;
        estado: string;
        explicacion: string;
    };
    latenciaTotalMs: number;
}

function parseFloatParam(valor: string | undefined, defaultValue: number): number {
    const parsed = parseFloat(valor || "");
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseIntParam(valor: string | undefined, defaultValue: number): number {
    const parsed = parseInt(valor || "", 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

async function leerParametros(overrides: SandboxOverrides): Promise<SandboxParametros> {
    const [
        modeloClasificacion,
        embeddingModel,
        anonymizationModel,
        umbralRevision,
        nVotos,
        temperatura,
        minScoreCategoria,
        ragTopK,
        ollamaNumParallel,
    ] = await Promise.all([
        getParametroSistema("reportes.classification_model"),
        getParametroSistema("reportes.embedding_model"),
        getParametroSistema("reportes.anonymization_model"),
        getParametroSistema("reportes.classification.umbral_revision"),
        getParametroSistema("reportes.classification.n_votos"),
        getParametroSistema("reportes.classification.temperatura_votos"),
        getParametroSistema("reportes.classification.min_score_categoria"),
        getParametroSistema("reportes.classification.rag_top_k"),
        getParametroSistema("reportes.classification.ollama_num_parallel"),
    ]);

    return {
        modeloClasificacion: overrides.modelo_clasificacion || modeloClasificacion?.valor || "ornith:9b",
        embeddingModel: embeddingModel?.valor || "nomic-embed-text",
        anonymizationModel: anonymizationModel?.valor || modeloClasificacion?.valor || "ornith:9b",
        umbralRevision: overrides.umbral_revision ?? parseFloatParam(umbralRevision?.valor, 1.0),
        nVotos: overrides.n_votos ?? parseIntParam(nVotos?.valor, 5),
        temperatura: overrides.temperatura_votos ?? parseFloatParam(temperatura?.valor, 0.7),
        minScoreCategoria: overrides.min_score_categoria ?? parseFloatParam(minScoreCategoria?.valor, 0.3),
        ragTopK: overrides.rag_top_k ?? parseIntParam(ragTopK?.valor, 3),
        ollamaNumParallel: parseIntParam(ollamaNumParallel?.valor, 2),
    };
}

function calcularDistribucion(votos: VotoIndividual[]): SandboxVotoDistribucion[] {
    const conteo = new Map<CategoriaConducta, number>();
    for (const voto of votos) {
        conteo.set(voto.categoria, (conteo.get(voto.categoria) || 0) + 1);
    }
    return Array.from(conteo.entries())
        .map(([categoria, count]) => ({ categoria, count }))
        .sort((a, b) => b.count - a.count);
}

function generarExplicacion(clasificacion: ClassificationResult, estadoFinal: string, prioridadAlta: boolean, guardas: { keywords: { tieneMatch: boolean }; doxing: { esDoxing: boolean } }): string {
    const base = `${clasificacion.categoria} con confianza ${(clasificacion.confianza * 100).toFixed(0)}%`;
    if (estadoFinal === "REVISION_MANUAL") {
        if (guardas.doxing.esDoxing) return `${base}. Escalado a revisión manual por señal de DOXING.`;
        if (guardas.keywords.tieneMatch && clasificacion.categoria === "OTRO") return `${base}. Escalado a revisión manual por keyword crítica en categoría OTRO.`;
        if (clasificacion.confianza < 1.0) return `${base}. No es unánime, requiere revisión humana.`;
        return `${base}. Requiere revisión manual.`;
    }
    if (prioridadAlta) return `${base}. Clasificado automáticamente con prioridad alta por keyword crítica.`;
    return `${base}. Clasificado automáticamente.`;
}

export async function ejecutarSandbox(texto: string, overrides: SandboxOverrides = {}): Promise<SandboxTrace> {
    const inicioTotal = Date.now();
    const parametros = await leerParametros(overrides);

    // 1. Embedding
    const inicioEmbedding = Date.now();
    const vector = await generarEmbedding(parametros.embeddingModel, texto);
    const latenciaEmbedding = Date.now() - inicioEmbedding;

    // 2. RAG
    const inicioRag = Date.now();
    const ejemplos = await buscarEjemplosSimilares(vector, { topK: parametros.ragTopK });
    const latenciaRag = Date.now() - inicioRag;

    // 3. Clasificación con votos
    const inicioVotacion = Date.now();
    const clasificacion = await clasificarConVotos(parametros.modeloClasificacion, texto, {
        nVotos: parametros.nVotos,
        temperatura: parametros.temperatura,
        minScoreCategoria: parametros.minScoreCategoria,
        umbralRevision: parametros.umbralRevision,
        ollamaNumParallel: parametros.ollamaNumParallel,
        ejemplos,
    });
    const latenciaVotacion = Date.now() - inicioVotacion;

    // 4. PII
    const inicioPii = Date.now();
    const pii: PiiDetectionResult = await detectarPiiCombinado(parametros.anonymizationModel, texto);
    const latenciaPii = Date.now() - inicioPii;

    // 5. Anonimización (solo si aplica)
    let anonimizacion: { latenciaMs: number; textoAnonimizado: string; piiDetectada: string[] } | undefined;
    if (pii.contienePii) {
        const inicioAnon = Date.now();
        const anonResult: AnonimizacionResult = await anonimizarTexto(parametros.anonymizationModel, texto, pii.piiDetectada);
        anonimizacion = {
            latenciaMs: Date.now() - inicioAnon,
            textoAnonimizado: anonResult.textoAnonimizado,
            piiDetectada: anonResult.piiDetectada,
        };
    }

    // 6. Guardas determinísticas (R3: nunca reclasifican)
    const inicioGuardas = Date.now();
    const doxing = detectarDoxing(texto);
    const keywords = detectarKeywordsRiesgo(texto);

    let estadoFinal = clasificacion.estado;
    let prioridadAlta = false;
    let keywordsDetectadas: string[] = [];
    let estadoForzado: string | undefined;

    if (doxing.esDoxing && clasificacion.categoria !== "DOXING") {
        estadoFinal = "REVISION_MANUAL";
        prioridadAlta = true;
        keywordsDetectadas = doxing.fragmentos.length > 0 ? doxing.fragmentos : ["doxing"];
        estadoForzado = "DOXING";
    }

    if (
        keywords.tieneMatch &&
        ((estadoFinal === "CLASIFICADO" && clasificacion.categoria === "OTRO") || estadoFinal === "REVISION_MANUAL")
    ) {
        prioridadAlta = true;
        keywordsDetectadas = Array.from(new Set([...keywordsDetectadas, ...keywords.keywords]));
        if (estadoFinal === "CLASIFICADO" && clasificacion.categoria === "OTRO") {
            estadoFinal = "REVISION_MANUAL";
            estadoForzado = "KEYWORDS";
        }
    }

    const latenciaGuardas = Date.now() - inicioGuardas;
    const latenciaTotal = Date.now() - inicioTotal;

    return {
        texto,
        parametrosEfectivos: parametros,
        etapas: {
            embedding: { latenciaMs: latenciaEmbedding, modelo: parametros.embeddingModel },
            rag: { latenciaMs: latenciaRag, topK: parametros.ragTopK, ejemplos },
            votacion: {
                latenciaMs: latenciaVotacion,
                votos: clasificacion.votos,
                distribucion: calcularDistribucion(clasificacion.votos),
                categoria: clasificacion.categoria,
                confianza: clasificacion.confianza,
                categoriasSecundarias: clasificacion.categoriasSecundarias,
                posibleAgresorPar: clasificacion.posibleAgresorPar,
                estado: clasificacion.estado,
            },
            pii: {
                latenciaMs: latenciaPii,
                contienePii: pii.contienePii,
                piiDetectada: pii.piiDetectada,
            },
            anonimizacion,
            guardas: {
                latenciaMs: latenciaGuardas,
                doxing: { esDoxing: doxing.esDoxing, fragmentos: doxing.fragmentos },
                keywords: { tieneMatch: keywords.tieneMatch, keywords: keywords.keywords },
                rafaga: { esRafaga: false, razon: "Requiere múltiples reportes contra el mismo identificador" },
                prioridadAlta,
                keywordsDetectadas,
                estadoForzado,
            },
        },
        decision: {
            categoria: clasificacion.categoria,
            confianza: clasificacion.confianza,
            estado: estadoFinal,
            explicacion: generarExplicacion(clasificacion, estadoFinal, prioridadAlta, { keywords, doxing }),
        },
        latenciaTotalMs: latenciaTotal,
    };
}
