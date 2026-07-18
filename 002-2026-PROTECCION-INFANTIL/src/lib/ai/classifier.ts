import { llamarOllamaStructured, type OllamaMetrics } from "./ollama-client";
import { classificationResponseSchema, type ClassificationResponse } from "./schemas";

export type CategoriaConducta =
    | "CONTACTO_INSISTENTE"
    | "SOLICITUD_MATERIAL"
    | "OFRECIMIENTO_REGALOS"
    | "SUPLANTACION_IDENTIDAD"
    | "SOLICITUD_ENCUENTRO"
    | "COMPARTIMIENTO_SEXUAL"
    | "EXTORSION"
    | "CONTENIDO_GENERADO_IA"
    | "DIFUSION_NO_CONSENTIDA"
    | "DOXING"
    | "SPAM"
    | "OTRO";

type EstadoReporte =
    | "PENDIENTE"
    | "PROCESANDO"
    | "CLASIFICADO"
    | "REVISION_MANUAL"
    | "POSIBLE_SPAM"
    | "DUPLICADO"
    | "REQUIERE_ANONIMIZACION"
    | "CORREGIDO";

export const CATEGORIAS_VALIDAS: CategoriaConducta[] = [
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "EXTORSION",
    "CONTENIDO_GENERADO_IA",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
    "SPAM",
    "OTRO",
];

export interface ClasificacionCategoria {
    categoria: CategoriaConducta;
    score: number;
}

export interface VotoIndividual {
    categoria: CategoriaConducta;
    confianza: number;
    posibleAgresorPar: boolean;
}

export interface EjemploClasificacion {
    texto: string;
    categoria: string;
}

export interface ClassificationResult {
    categoria: CategoriaConducta;
    confianza: number;
    categoriasSecundarias: ClasificacionCategoria[];
    posibleAgresorPar: boolean;
    estado: EstadoReporte;
    rawResponse: string;
    metrics: OllamaMetrics;
    fallback: boolean;
    votos: VotoIndividual[];
    usoCascada?: boolean;
    modeloCascada?: string;
    desempateLatencyMs?: number;
    desempateLoadDuration?: number | null;
}

export interface VotingConfig {
    nVotos: number;
    temperatura: number;
    seeds: number[];
    minScoreCategoria: number;
    umbralRevision: number;
    ollamaNumParallel: number;
    ejemplos?: EjemploClasificacion[];
    modeloDesempate?: string;
    keepAliveDesempate?: number;
}

const DEFAULT_VOTING_CONFIG: VotingConfig = {
    nVotos: 5,
    temperatura: 0.7,
    // Seeds fijos por índice de voto para reproducibilidad entre evaluaciones.
    // Esto hace que cada run sea determinista dado el mismo modelo/prompt/fixture.
    seeds: [42, 123, 456, 789, 1024],
    minScoreCategoria: 0.3,
    // F5: la política ganadora del A/B (RAG+votos, umbral 1.0) minimizó error_silencioso a 21.9%.
    umbralRevision: 1.0,
    ollamaNumParallel: 2,
};

function buildSystemPrompt(ejemplos?: EjemploClasificacion[]): string {
    const basePrompt = `Eres un clasificador especializado en protección infantil. Analiza el texto del reporte y responde con el JSON estructurado solicitado.

Categorías:
- CONTACTO_INSISTENTE: contacto repetido e incómodo
- SOLICITUD_MATERIAL: solicitud explícita de fotos, videos o material íntimo/desnudo
- OFRECIMIENTO_REGALOS: ofrecimiento de dinero, regalos o beneficios a cambio de algo
- SUPLANTACION_IDENTIDAD: fingir ser menor, familiar, amigo o figura de autoridad
- SOLICITUD_ENCUENTRO: solicitud de reunión física o encontrarse en persona
- COMPARTIMIENTO_SEXUAL: envío, exhibición o compartición de material sexual
- EXTORSION: chantaje o amenazas para obtener contenido, dinero o silencio
- CONTENIDO_GENERADO_IA: uso de IA para generar material sexual o manipular imágenes
- DIFUSION_NO_CONSENTIDA: compartir imágenes o información íntima sin permiso
- DOXING: publicar información personal para identificar, localizar o dañar
- SPAM: contenido promocional, comercial o irrelevante sin relación con protección infantil
- OTRO: conducta real que no encaja en las anteriores

Fronteras excluyentes y ejemplos contrastivos:
- SOLICITUD_MATERIAL vs COMPARTIMIENTO_SEXUAL:
  - "envíame fotos desnudas" → SOLICITUD_MATERIAL
  - "te mando mis fotos íntimas" → COMPARTIMIENTO_SEXUAL
  - "muéstrate por cámara" → SOLICITUD_MATERIAL
  - "mira lo que te envío" (contenido sexual) → COMPARTIMIENTO_SEXUAL
- OFRECIMIENTO_REGALOS vs EXTORSION:
  - "te compro un celular si me mandas fotos" → OFRECIMIENTO_REGALOS
  - "si no me mandas fotos, le cuento a todos" → EXTORSION
- SUPLANTACION_IDENTIDAD requiere fingimiento de identidad; un adulto contactando a un menor no basta.
- DOXING requiere intención de publicar, difundir o revelar datos personales para identificar, localizar o dañar. Mencionar una dirección o teléfono NO es DOXING si no hay intención de publicación.
  - "Voy a publicar su dirección: cra 7 # 45-67" → DOXING
  - "El menor vive en carrera 45 # 12-34" → OTRO (dato personal mencionado, sin intención de publicar)
- OTRO: usa esta categoría cuando el texto no describa una conducta de riesgo específica, aunque mencione el tema sexual o datos personales. Una categoría sexual requiere que la conducta (pedir o enviar) esté presente en el texto.
  - "me dijo cosas raras por chat" → OTRO (no se describe conducta concreta)
  - "hablamos de sexo" → OTRO (tema sexual, sin solicitud ni envío)
  - "me mostró un video de otra persona" → OTRO (menciona video, pero no se sabe si es íntimo ni si lo envió el agresor)
  - "me pidió que le contara detalles de mi cuerpo" → SOLICITUD_MATERIAL (solicitud de contenido íntimo)
  - "me envió fotos de partes íntimas" → COMPARTIMIENTO_SEXUAL (envío concreto de material sexual)

posible_agresor_par: true si el posible agresor parece ser otro adolescente, compañero de escuela, amigo de la edad o par del entorno cercano (lenguaje adolescente, juegos como Roblox/Free Fire, colegio, compañeros).

Si el texto es ambiguo, incompleto o no puedes clasificar con confianza, usa categoria "OTRO" y confianza baja (< 0.5).`;

    if (!ejemplos || ejemplos.length === 0) {
        return basePrompt + "\n\nResponde SOLO el JSON, sin markdown, sin explicaciones.";
    }

    const ejemplosTexto = ejemplos
        .map((e, i) => `Ejemplo corregido ${i + 1}:\nTexto: "${e.texto}"\nCategoría: ${e.categoria}`)
        .join("\n\n");

    return (
        basePrompt +
        "\n\nUsa los siguientes ejemplos corregidos como referencia para fronteras difíciles:\n\n" +
        ejemplosTexto +
        "\n\nResponde SOLO el JSON, sin markdown, sin explicaciones."
    );
}

export async function clasificarReporte(
    modelo: string,
    texto: string,
    umbralRevision: number = 0.5,
    options?: Record<string, unknown>,
    ejemplos?: EjemploClasificacion[]
): Promise<ClassificationResult> {
    const userPrompt = `Texto del reporte: "${texto}"`;
    const systemPrompt = buildSystemPrompt(ejemplos);

    try {
        const { data, rawResponse, metrics } = await llamarOllamaStructured<ClassificationResponse>(
            modelo,
            userPrompt,
            classificationResponseSchema,
            systemPrompt,
            options
        );

        const categoria = parseCategoria(data.categoria);
        const confianza = clamp(data.confianza, 0, 1);
        const posibleAgresorPar = Boolean(data.posible_agresor_par);
        const estado = determineEstado(confianza, umbralRevision);

        return {
            categoria,
            confianza,
            categoriasSecundarias: [],
            posibleAgresorPar,
            estado,
            rawResponse,
            metrics,
            fallback: false,
            votos: [{ categoria, confianza, posibleAgresorPar }],
        };
    } catch (err) {
        console.error("[CLASSIFIER] Structured output falló, usando fallback:", err instanceof Error ? err.message : err);
        return fallbackResult(modelo, texto);
    }
}

async function desempatarConModeloGrande(
    modeloDesempate: string,
    texto: string,
    moda: CategoriaConducta,
    ranking: { categoria: CategoriaConducta; count: number; score: number }[],
    ejemplos?: EjemploClasificacion[],
    keepAlive?: number
): Promise<{ categoria: CategoriaConducta; rawResponse: string; metrics: OllamaMetrics; modeloCascada: string } | null> {
    const systemPrompt = buildSystemPrompt(ejemplos) +
        "\n\nEste texto fue votado por un modelo base y no alcanzó unanimidad. " +
        "Usa los ejemplos y el conteo de votos para decidir la categoría final. " +
        "Si la ambigüedad persiste, responde OTRO.";

    const votosInfo = ranking.map((r) => `- ${r.categoria}: ${r.count} voto(s)`).join("\n");
    const userPrompt = `Texto del reporte: "${texto}"\n\nConteo de votos del modelo base:\n${votosInfo}\n\nDecidí la categoría final.`;

    try {
        const { data, rawResponse, metrics } = await llamarOllamaStructured<ClassificationResponse>(
            modeloDesempate,
            userPrompt,
            classificationResponseSchema,
            systemPrompt,
            { temperature: 0, seed: 42 },
            keepAlive ?? 0
        );
        return { categoria: parseCategoria(data.categoria), rawResponse, metrics, modeloCascada: modeloDesempate };
    } catch (err) {
        console.error("[CLASSIFIER] Desempate falló:", err instanceof Error ? err.message : err);
        return null;
    }
}

export async function clasificarConVotos(
    modelo: string,
    texto: string,
    config?: Partial<VotingConfig>
): Promise<ClassificationResult> {
    const cfg: VotingConfig = { ...DEFAULT_VOTING_CONFIG, ...config };
    const umbralRevision = cfg.umbralRevision;
    const ejemplos = cfg.ejemplos;

    const seeds = cfg.seeds.slice(0, cfg.nVotos);
    if (seeds.length < cfg.nVotos) {
        // Rellenar seeds faltantes con una secuencia determinista
        for (let i = seeds.length; i < cfg.nVotos; i++) {
            seeds.push(1000 + i);
        }
    }

    const votosResult: ClassificationResult[] = [];
    const batchSize = Math.max(1, cfg.ollamaNumParallel);

    for (let i = 0; i < cfg.nVotos; i += batchSize) {
        const batch = seeds.slice(i, i + batchSize).map((seed) =>
            clasificarReporte(modelo, texto, umbralRevision, {
                temperature: cfg.temperatura,
                seed,
            }, ejemplos)
        );
        const batchResults = await Promise.all(batch);
        votosResult.push(...batchResults);
    }

    const votos: VotoIndividual[] = votosResult.map((v) => ({
        categoria: v.categoria,
        confianza: v.confianza,
        posibleAgresorPar: v.posibleAgresorPar,
    }));

    const conteo = new Map<CategoriaConducta, { count: number; confSum: number }>();
    for (const v of votos) {
        const actual = conteo.get(v.categoria) ?? { count: 0, confSum: 0 };
        actual.count += 1;
        actual.confSum += v.confianza;
        conteo.set(v.categoria, actual);
    }

    const ranking = Array.from(conteo.entries())
        .map(([categoria, { count, confSum }]) => ({
            categoria,
            count,
            score: count / cfg.nVotos,
            confPromedio: confSum / count,
        }))
        .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return b.confPromedio - a.confPromedio;
        });

    const ganador = ranking[0];
    const categoria = ganador?.categoria ?? "OTRO";
    const confianza = ganador?.score ?? 0;

    const categoriasSecundarias: ClasificacionCategoria[] = ranking
        .filter((r) => r.categoria !== categoria && r.score >= cfg.minScoreCategoria)
        .map((r) => ({ categoria: r.categoria, score: r.score }));

    // S4: voto mayoritario para posibleAgresorPar (evita sobre-disparo del OR-de-5).
    const trueParVotes = votos.filter((v) => v.posibleAgresorPar).length;
    const posibleAgresorPar = trueParVotes / cfg.nVotos >= 0.5;
    let estado = determineEstado(confianza, umbralRevision);
    let categoriaFinal = categoria;
    let confianzaFinal = confianza;
    let usoCascada = false;
    let modeloCascada: string | undefined;
    let cascadaRawResponse: string | undefined;
    let cascadaMetrics: OllamaMetrics | undefined;

    // F6: cascada de desempate para casos no unánimes.
    if (
        cfg.modeloDesempate &&
        confianza < 1.0 &&
        estado === "REVISION_MANUAL"
    ) {
        const rankingResumen = ranking.map((r) => ({ categoria: r.categoria, count: r.count, score: r.score }));
        const desempate = await desempatarConModeloGrande(
            cfg.modeloDesempate,
            texto,
            categoria,
            rankingResumen,
            ejemplos,
            cfg.keepAliveDesempate
        );
        if (desempate) {
            usoCascada = true;
            modeloCascada = desempate.modeloCascada;
            cascadaRawResponse = desempate.rawResponse;
            cascadaMetrics = desempate.metrics;
            if (desempate.categoria === categoria) {
                // El modelo grande confirma la moda: auto-clasificar.
                estado = "CLASIFICADO";
                confianzaFinal = 1.0;
            }
            // Si contradice la moda, se mantiene REVISION_MANUAL.
        }
    }

    const allFallback = votosResult.every((v) => v.fallback);

    const metrics: OllamaMetrics = {
        modelo,
        latenciaMs: votosResult.reduce((sum, v) => sum + v.metrics.latenciaMs, 0) + (cascadaMetrics?.latenciaMs ?? 0),
        promptTokens: votosResult.reduce((sum, v) => sum + (v.metrics.promptTokens ?? 0), 0) + (cascadaMetrics?.promptTokens ?? 0),
        responseTokens: votosResult.reduce((sum, v) => sum + (v.metrics.responseTokens ?? 0), 0) + (cascadaMetrics?.responseTokens ?? 0),
        totalDuration: null,
        loadDuration: cascadaMetrics?.loadDuration ?? null,
    };

    const rawResponse = JSON.stringify({
        modo: "votacion",
        nVotos: cfg.nVotos,
        temperatura: cfg.temperatura,
        votos,
        agregacion: {
            categoria: categoriaFinal,
            confianza: confianzaFinal,
            categoriasSecundarias,
            posibleAgresorPar,
            estado,
        },
        cascada: usoCascada
            ? {
                  modelo: modeloCascada,
                  rawResponse: cascadaRawResponse,
              }
            : undefined,
    });

    return {
        categoria: categoriaFinal,
        confianza: confianzaFinal,
        categoriasSecundarias,
        posibleAgresorPar,
        estado,
        rawResponse,
        metrics,
        fallback: allFallback,
        votos,
        usoCascada,
        modeloCascada,
        desempateLatencyMs: cascadaMetrics?.latenciaMs,
        desempateLoadDuration: cascadaMetrics?.loadDuration,
    };
}

function parseCategoria(raw: string): CategoriaConducta {
    const normalized = raw.toUpperCase().trim();
    if (CATEGORIAS_VALIDAS.includes(normalized as CategoriaConducta)) {
        return normalized as CategoriaConducta;
    }
    return "OTRO";
}

function clamp(n: number, min: number, max: number): number {
    return Math.min(Math.max(n, min), max);
}

function determineEstado(confianza: number, umbralRevision: number): EstadoReporte {
    if (confianza < umbralRevision) return "REVISION_MANUAL";
    return "CLASIFICADO";
}

function fallbackResult(modelo: string, texto: string): ClassificationResult {
    return {
        categoria: "OTRO",
        confianza: 0,
        categoriasSecundarias: [],
        posibleAgresorPar: false,
        estado: "REVISION_MANUAL",
        rawResponse: `{"categoria":"OTRO","confianza":0,"posible_agresor_par":false,"_fallback":true,"_input":"${texto}"}`,
        metrics: {
            modelo,
            latenciaMs: 0,
            promptTokens: null,
            responseTokens: null,
            totalDuration: null,
            loadDuration: null,
        },
        fallback: true,
        votos: [{ categoria: "OTRO", confianza: 0, posibleAgresorPar: false }],
    };
}
