import { llamarOllamaStructured, type OllamaMetrics } from "./ollama-client";
import { getParametroSistema } from "@/lib/parametros";
import { obtenerSeveridades } from "@/lib/scoring";
import { logger } from "@/lib/logger";
import { RUBRICA_SEMILLA, type SetsRubrica, type PreguntaRubrica } from "./rubrica-semilla";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

/**
 * Motor de clasificación por RÚBRICA (spec 090).
 * Objetivo (preguntas factuales), multi-etiqueta (0/1 por categoría) y multi-modelo
 * (N modelos diversos, 1 voto c/u, secuencial). % por categoría = 1s/N.
 * Desacuerdo entre modelos = revisión humana. Todo parametrizable (ADR_004).
 */

export interface ConfigRubrica {
    enabled: boolean;
    preguntas: SetsRubrica;
    modelos: string[];
    temperatura: number;
    umbralPresencia: number;
    modeloEmbudo: string;
}

export interface VotoRubricaCategoria {
    cumple: boolean;
    preguntasCumplidas: string[];
}

export interface VotoRubricaModelo {
    modelo: string;
    categorias: Record<string, VotoRubricaCategoria>;
    metrics: OllamaMetrics;
    fallback: boolean;
}

export interface ResultadoRubrica {
    categoria: CategoriaConducta;
    confianza: number;
    categoriasPresentes: string[];
    categoriasSecundarias: Array<{ categoria: string; score: number }>;
    porcentajes: Record<string, number>;
    estado: EstadoReporte;
    votosModelos: VotoRubricaModelo[];
    metrics: { modelo: string; latenciaMs: number; promptTokens: number | null; responseTokens: number | null };
    rawResponse: string;
    fallback: boolean;
}

const embudoSchema = {
    type: "object",
    properties: {
        categoriasPlausibles: {
            type: "array",
            items: { type: "string" },
            description: "Categorías con ALGUNA señal concreta en el texto (vacío si ninguna).",
        },
    },
    required: ["categoriasPlausibles"],
    additionalProperties: false,
};

const votoCategoriaSchema = {
    type: "object",
    properties: {
        cumple: { type: "integer", enum: [0, 1], description: "1 solo si TODAS las preguntas se cumplen con evidencia clara." },
        preguntasCumplidas: { type: "array", items: { type: "string" } },
    },
    required: ["cumple", "preguntasCumplidas"],
    additionalProperties: false,
};

function construirVotoSchema(categorias: string[]) {
    return {
        type: "object",
        properties: {
            categorias: {
                type: "object",
                properties: Object.fromEntries(categorias.map((c) => [c, votoCategoriaSchema])),
                required: categorias,
                additionalProperties: false,
            },
        },
        required: ["categorias"],
        additionalProperties: false,
    };
}

interface EmbudoResponse {
    categoriasPlausibles: string[];
}

interface VotoModeloResponse {
    categorias: Record<string, { cumple: number; preguntasCumplidas: string[] }>;
}

export async function cargarConfigRubrica(): Promise<ConfigRubrica> {
    const [enabled, preguntas, modelos, temperatura, umbral, embudo] = await Promise.all([
        getParametroSistema("ia.rubrica.enabled"),
        getParametroSistema("ia.rubrica.preguntas"),
        getParametroSistema("ia.rubrica.modelos"),
        getParametroSistema("ia.rubrica.temperatura"),
        getParametroSistema("ia.rubrica.umbral_presencia"),
        getParametroSistema("ia.rubrica.modelo_embudo"),
    ]);
    return {
        enabled: enabled?.valor !== "false",
        preguntas: preguntas ? (JSON.parse(preguntas.valor) as SetsRubrica) : RUBRICA_SEMILLA,
        modelos: modelos ? (JSON.parse(modelos.valor) as string[]) : ["gemma2:27b", "qwen2.5:14b", "aya-expanse:32b"],
        temperatura: temperatura ? parseFloat(temperatura.valor) : 0.2,
        umbralPresencia: umbral ? parseFloat(umbral.valor) : 0.6,
        modeloEmbudo: embudo?.valor ?? "qwen2.5:14b",
    };
}

function preguntasActivas(sets: SetsRubrica, categoria: string): PreguntaRubrica[] {
    return (sets[categoria] ?? []).filter((p) => p.activo);
}

function construirPromptEmbudo(texto: string, categorias: string[]): string {
    return `Eres un analista de reportes de riesgos para menores. Lee el texto y decide QUÉ categorías tienen ALGUNA señal (sospecha razonable). Sé estricto: incluye una categoría SOLO si hay una señal concreta en el texto; ante la duda, NO la incluyas.

Categorías posibles: ${categorias.join(", ")}

Texto del reporte: "${texto}"

Responde SOLO con JSON: {"categoriasPlausibles": ["CATEGORIA1", ...]} (vacío si ninguna tiene señal).`;
}

function construirPromptVoto(texto: string, sets: SetsRubrica, categorias: string[]): string {
    const bloques = categorias
        .map((cat) => {
            const preguntas = preguntasActivas(sets, cat)
                .map((p, i) => `  ${i + 1}. ${p.texto}`)
                .join("\n");
            return `- ${cat}:\n${preguntas}`;
        })
        .join("\n");
    return `Eres un evaluador ESTRICTO de reportes de riesgos para menores. Evalúa el texto con la rúbrica de cada categoría.

REGLAS OBLIGATORIAS:
- Marca 1 SOLO si TODAS las preguntas activas de la categoría se cumplen con evidencia CLARA en el texto.
- Ante la duda, marca 0. Denegar por defecto: la ausencia de evidencia es 0, nunca 1.
- Las preguntas son factuales y específicas: "¿se COMPARTIÓ?" no es lo mismo que "¿se pidió?". No confundas categorías.
- En "preguntasCumplidas" lista el texto de las preguntas que efectivamente se cumplen.

Texto del reporte: "${texto}"

Rúbrica por categoría:
${bloques}

Responde SOLO con JSON: {"categorias": {"CATEGORIA": {"cumple": 0|1, "preguntasCumplidas": ["..."]}, ...}} incluyendo TODAS las categorías de la rúbrica.`;
}

/** % por categoría = nº de modelos que marcaron 1 / N. */
export function calcularPorcentajes(votos: VotoRubricaModelo[], categorias: string[]): Record<string, number> {
    const n = Math.max(1, votos.filter((v) => !v.fallback).length);
    const porcentajes: Record<string, number> = {};
    for (const cat of categorias) {
        const unos = votos.filter((v) => !v.fallback && v.categorias[cat]?.cumple).length;
        porcentajes[cat] = unos / n;
    }
    return porcentajes;
}

/** Categorías presentes = las que superan el umbral de presencia. Principal = mayor severidad. */
export function resolverPresentesYPrincipal(
    porcentajes: Record<string, number>,
    umbral: number,
    severidades: Record<string, number>
): { presentes: string[]; principal: string | null } {
    const presentes = Object.entries(porcentajes)
        .filter(([, pct]) => pct >= umbral)
        .sort((a, b) => (severidades[b[0]] ?? 0) - (severidades[a[0]] ?? 0))
        .map(([cat]) => cat);
    return { presentes, principal: presentes[0] ?? null };
}

/** Análisis determinista por plantilla (spec 090-US3). */
export function generarAnalisisRubrica(
    votos: VotoRubricaModelo[],
    porcentajes: Record<string, number>,
    umbral: number
): string {
    const n = Math.max(1, votos.filter((v) => !v.fallback).length);
    const partes: string[] = [];
    for (const [cat, pct] of Object.entries(porcentajes).sort((a, b) => b[1] - a[1])) {
        const unos = Math.round(pct * n);
        if (unos === 0) continue;
        const acuerdo = unos === n ? `Acuerdo total (${unos}/${n})` : `Acuerdo parcial (${unos}/${n})`;
        const estado = pct >= umbral ? "supera el umbral de presencia" : "no alcanza el umbral";
        partes.push(`${acuerdo} en ${cat}: ${estado}.`);
    }
    if (partes.length === 0) {
        return `Ningún modelo encontró evidencia clara en ninguna categoría (0/${n}). El caso pasa a revisión humana.`;
    }
    return partes.join(" ");
}

export async function clasificarConRubrica(texto: string, config?: Partial<ConfigRubrica>): Promise<ResultadoRubrica> {
    const cfg: ConfigRubrica = { ...(await cargarConfigRubrica()), ...config };
    const categoriasPosibles = Object.keys(cfg.preguntas).filter((cat) => preguntasActivas(cfg.preguntas, cat).length > 0);
    const inicio = Date.now();
    let promptTokens = 0;
    let responseTokens = 0;

    // Embudo: pase barato que descarta categorías sin señal
    let plausibles: string[] = [];
    let embudoFallback = false;
    try {
        const embudo = await llamarOllamaStructured<EmbudoResponse>(
            cfg.modeloEmbudo,
            construirPromptEmbudo(texto, categoriasPosibles),
            embudoSchema,
            "Eres un analista estricto de reportes.",
            { temperature: cfg.temperatura }
        );
        promptTokens += embudo.metrics.promptTokens ?? 0;
        responseTokens += embudo.metrics.responseTokens ?? 0;
        plausibles = embudo.data.categoriasPlausibles.filter((c) => categoriasPosibles.includes(c));
    } catch (err) {
        embudoFallback = true;
        logger.warn(`[RUBRICA] Embudo falló (${err instanceof Error ? err.message : String(err)}); rúbrica completa sobre todas las categorías.`);
        plausibles = categoriasPosibles;
    }

    const votosModelos: VotoRubricaModelo[] = [];
    if (plausibles.length > 0) {
        // Votación multi-modelo SECUENCIAL (1 voto por modelo; cuida la RAM)
        for (const modelo of cfg.modelos) {
            try {
                const voto = await llamarOllamaStructured<VotoModeloResponse>(
                    modelo,
                    construirPromptVoto(texto, cfg.preguntas, plausibles),
                    construirVotoSchema(plausibles),
                    "Eres un evaluador estricto de rúbricas de clasificación.",
                    { temperature: cfg.temperatura }
                );
                promptTokens += voto.metrics.promptTokens ?? 0;
                responseTokens += voto.metrics.responseTokens ?? 0;
                const categorias: Record<string, VotoRubricaCategoria> = {};
                for (const cat of plausibles) {
                    const v = voto.data.categorias[cat];
                    categorias[cat] = { cumple: v?.cumple === 1, preguntasCumplidas: v?.preguntasCumplidas ?? [] };
                }
                votosModelos.push({ modelo, categorias, metrics: voto.metrics, fallback: false });
            } catch (err) {
                logger.error(`[RUBRICA] Voto falló en ${modelo}: ${err instanceof Error ? err.message : String(err)}`);
                votosModelos.push({
                    modelo,
                    categorias: {},
                    metrics: { modelo, latenciaMs: 0, promptTokens: null, responseTokens: null, totalDuration: null, loadDuration: null },
                    fallback: true,
                });
            }
        }
    }

    const votosValidos = votosModelos.filter((v) => !v.fallback);
    const porcentajes = calcularPorcentajes(votosModelos, plausibles);
    const severidades = await obtenerSeveridades();
    const severidadesStr: Record<string, number> = Object.fromEntries(
        Object.entries(severidades).map(([k, v]) => [k, v])
    );
    const { presentes, principal } = resolverPresentesYPrincipal(porcentajes, cfg.umbralPresencia, severidadesStr);

    // Decisión (spec 089 intacta): ninguna supera umbral → revisión humana (desacuerdo); OTRO → revisión.
    const categoriaFinal = (principal ?? "OTRO") as CategoriaConducta;
    const estado: EstadoReporte = principal === null ? "REVISION_MANUAL" : "CLASIFICADO";
    const confianza = principal ? (porcentajes[principal] ?? 0) : 0;
    const categoriasSecundarias = presentes
        .filter((cat) => cat !== principal)
        .map((cat) => ({ categoria: cat, score: porcentajes[cat] ?? 0 }));

    const fallback = votosValidos.length === 0 && plausibles.length > 0;
    const latenciaMs = Date.now() - inicio;

    return {
        categoria: categoriaFinal,
        confianza,
        categoriasPresentes: presentes,
        categoriasSecundarias,
        porcentajes,
        estado: fallback ? "REVISION_MANUAL" : estado,
        votosModelos,
        metrics: {
            modelo: `rubrica:${cfg.modelos.join("+")}`,
            latenciaMs,
            promptTokens: promptTokens || null,
            responseTokens: responseTokens || null,
        },
        rawResponse: JSON.stringify({
            modo: "rubrica",
            embudo: { modelo: cfg.modeloEmbudo, plausibles, fallback: embudoFallback },
            porcentajes,
            umbralPresencia: cfg.umbralPresencia,
        }),
        fallback,
    };
}
