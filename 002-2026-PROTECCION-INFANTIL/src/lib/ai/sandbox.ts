import { getParametroSistema, getParametroSistemaValor } from "@/lib/parametros";
import { generarEmbedding } from "./embedder";
import { buscarEjemplosSimilares, type EjemploRecuperado } from "./dataset-retrieval";
import { clasificarConMotorActivo, type ResultadoMotor } from "./motor";
import { detectarPiiCombinado, type PiiDetectionResult } from "./pii-detector";
import { anonimizarTexto, type AnonimizacionResult } from "./anonimizador";
import { decidirGuardasSeguridad, normalizarCategoriasSecundarias } from "./guardas-decision";
import { MODELO_ANONIMIZACION_DEFAULT, MODELO_EMBEDDING_DEFAULT } from "./defaults";
import { workerLogger } from "@/lib/monitoreo/worker-logger";
import type { CategoriaConducta } from "@prisma/client";
import type { VotoRubricaModelo } from "./rubrica";

export interface SandboxOverrides {
    temperatura?: number | undefined;
    umbral_presencia?: number | undefined;
    modelos?: string[] | undefined;
    rag_top_k?: number | undefined;
}

export interface SandboxParametros {
    modelos: string[];
    embeddingModel: string;
    anonymizationModel: string;
    temperatura: number;
    umbralPresencia: number;
    ragTopK: number;
    ollamaNumParallel: number;
    umbralSpam: number;
    umbralSpamDominancia: number;
    severidadMinGrave: number;
    dominiosAcortadores: string[];
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
            votos: SandboxVotoDistribucion[];
            modelos: number;
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
        } | undefined;
        guardas: {
            latenciaMs: number;
            doxing: { esDoxing: boolean; fragmentos: string[] };
            keywords: { tieneMatch: boolean; keywords: string[] };
            rafaga: { esRafaga: false; razon: string };
            prioridadAlta: boolean;
            keywordsDetectadas: string[];
            estadoForzado?: string | undefined;
            reglasAplicadas: string[];
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
        modelosRaw,
        embeddingModel,
        anonymizationModel,
        temperatura,
        umbralPresencia,
        ragTopK,
        ollamaNumParallel,
        umbralSpam,
        umbralSpamDominancia,
        severidadMinGrave,
        dominiosAcortadoresRaw,
    ] = await Promise.all([
        getParametroSistema("ia.rubrica.modelos"),
        getParametroSistema("reportes.embedding_model"),
        getParametroSistema("reportes.anonymization_model"),
        getParametroSistema("ia.rubrica.temperatura"),
        getParametroSistema("ia.rubrica.umbral_presencia"),
        getParametroSistema("reportes.classification.rag_top_k"),
        getParametroSistema("reportes.classification.ollama_num_parallel"),
        // Misma clave y default que producción (helpers/parametros.ts)
        getParametroSistema("clasificacion.umbral_spam"),
        getParametroSistema("spam.dominancia_umbral"),
        getParametroSistema("spam.dominancia_categoria_grave_severidad_min"),
        getParametroSistema("spam.dominios_acortadores"),
    ]);

    const modelosDefault = ["gemma2:27b", "qwen2.5:14b", "aya-expanse:32b"];
    const modelos = overrides.modelos ?? (modelosRaw ? (JSON.parse(modelosRaw.valor) as string[]) : modelosDefault);
    const dominiosAcortadores: string[] = (() => {
        try {
            return dominiosAcortadoresRaw?.valor ? (JSON.parse(dominiosAcortadoresRaw.valor) as string[]) : [];
        } catch {
            return [];
        }
    })();

    return {
        modelos,
        embeddingModel: embeddingModel?.valor || MODELO_EMBEDDING_DEFAULT,
        anonymizationModel: anonymizationModel?.valor || MODELO_ANONIMIZACION_DEFAULT,
        temperatura: overrides.temperatura ?? parseFloatParam(temperatura?.valor, 0.2),
        umbralPresencia: overrides.umbral_presencia ?? parseFloatParam(umbralPresencia?.valor, 0.6),
        ragTopK: overrides.rag_top_k ?? parseIntParam(ragTopK?.valor, 3),
        ollamaNumParallel: parseIntParam(ollamaNumParallel?.valor, 2),
        umbralSpam: parseFloatParam(umbralSpam?.valor, 0.7),
        umbralSpamDominancia: parseFloatParam(umbralSpamDominancia?.valor, 0.33),
        severidadMinGrave: parseIntParam(severidadMinGrave?.valor, 75),
        dominiosAcortadores,
    };
}

function calcularDistribucion(votos: VotoRubricaModelo[]): SandboxVotoDistribucion[] {
    const conteo = new Map<CategoriaConducta, number>();
    for (const voto of votos) {
        if (voto.fallback) continue;
        for (const [categoria, { cumple }] of Object.entries(voto.categorias)) {
            if (cumple) {
                conteo.set(categoria as CategoriaConducta, (conteo.get(categoria as CategoriaConducta) || 0) + 1);
            }
        }
    }
    return Array.from(conteo.entries())
        .map(([categoria, count]) => ({ categoria, count }))
        .sort((a, b) => b.count - a.count);
}

/** SPEC-207: loggear modelos de rúbrica que no respondieron. */
export function logModelosSinRespuesta(votos: VotoRubricaModelo[]): void {
    for (const voto of votos) {
        if (voto.fallback) {
            void workerLogger.error("Rúbrica: modelo sin respuesta", {
                modelo: voto.modelo,
                latenciaMs: voto.metrics.latenciaMs,
            });
        }
    }
}

function generarExplicacion(clasificacion: ResultadoMotor, estadoFinal: string, prioridadAlta: boolean, guardas: { keywords: { tieneMatch: boolean }; doxing: { esDoxing: boolean } }): string {
    const base = `${clasificacion.categoria} con confianza ${(clasificacion.confianza * 100).toFixed(0)}%`;
    if (estadoFinal === "POSIBLE_SPAM") {
        return `${base}. Posible spam con confianza suficiente: pasa a revisión humana.`;
    }
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

    // 3. Clasificación — SPEC-138 (E-7): el único motor activo es la rúbrica.
    const inicioVotacion = Date.now();
    const clasificacion = await clasificarConMotorActivo(texto, {
        configRubrica: {
            modelos: parametros.modelos,
            temperatura: parametros.temperatura,
            umbralPresencia: parametros.umbralPresencia,
        },
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

    // SPEC-199: severidades para la guarda de dominancia SPAM.
    const categoriasNecesarias = [
        clasificacion.categoria,
        ...clasificacion.categoriasSecundarias
            .filter((c): c is { categoria: string; score: number } => typeof c === "object" && c !== null && typeof (c as Record<string, unknown>).categoria === "string")
            .map((c) => c.categoria),
    ];
    const severidades: Record<string, number> = {};
    await Promise.all(
        categoriasNecesarias.map(async (categoria) => {
            const valor = await getParametroSistemaValor(`scoring.severity.${categoria}`);
            if (valor !== null) severidades[categoria] = parseInt(valor, 10);
        })
    );

    // 6. Guardas determinísticas: misma decisión que producción (spec 123).
    // esRafaga=false: el sandbox procesa un solo texto; la ráfaga requiere
    // múltiples reportes contra el mismo identificador.
    const inicioGuardas = Date.now();
    const decision = decidirGuardasSeguridad({
        texto,
        clasificacion: { categoria: clasificacion.categoria, confianza: clasificacion.confianza },
        categoriasSecundarias: normalizarCategoriasSecundarias(clasificacion.categoriasSecundarias),
        estadoInicial: clasificacion.estado,
        esRafaga: false,
        umbralSpam: parametros.umbralSpam,
        umbralSpamDominancia: parametros.umbralSpamDominancia,
        severidadMinGrave: parametros.severidadMinGrave,
        severidades,
        dominiosAcortadores: parametros.dominiosAcortadores,
    });
    const { estadoFinal, prioridadAlta, keywordsDetectadas, doxing, keywordsRiesgo: keywords, reglasAplicadas } = decision;

    // estadoForzado conserva la semántica anterior de la traza: qué guarda
    // escaló a revisión manual (solo informativo, no cambia decisiones).
    let estadoForzado: string | undefined;
    if (reglasAplicadas.includes("doxing_no_reflejado_por_modelo")) {
        estadoForzado = "DOXING";
    } else if (
        reglasAplicadas.includes("keywords_riesgo") &&
        clasificacion.estado === "CLASIFICADO" &&
        clasificacion.categoria === "OTRO"
    ) {
        estadoForzado = "KEYWORDS";
    }

    const latenciaGuardas = Date.now() - inicioGuardas;
    const latenciaTotal = Date.now() - inicioTotal;

    const votosModelos = (clasificacion.rubrica?.votosModelos as VotoRubricaModelo[]) ?? [];
    const distribucion = calcularDistribucion(votosModelos);

    // SPEC-207: instrumentar modelos de rúbrica que no respondieron.
    // No altera el resultado; solo expone el modelo y latencia para diagnóstico.
    logModelosSinRespuesta(votosModelos);

    const secundariasLegacy = clasificacion.categoriasSecundarias.filter(
        (v): v is { categoria: CategoriaConducta; score: number } =>
            typeof v === "object" && v !== null && "categoria" in v && "score" in v
    );

    return {
        texto,
        parametrosEfectivos: parametros,
        etapas: {
            embedding: { latenciaMs: latenciaEmbedding, modelo: parametros.embeddingModel },
            rag: { latenciaMs: latenciaRag, topK: parametros.ragTopK, ejemplos },
            votacion: {
                latenciaMs: latenciaVotacion,
                votos: distribucion,
                modelos: parametros.modelos.length,
                categoria: clasificacion.categoria,
                confianza: clasificacion.confianza,
                categoriasSecundarias: secundariasLegacy,
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
                reglasAplicadas,
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
