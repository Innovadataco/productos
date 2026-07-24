import { llamarOllamaStructured, type OllamaMetrics } from "./ollama-client";
import { getParametroSistema } from "@/lib/parametros";
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

/** Spec 092-US1: decisivas = núcleo obligatorio; contexto = no bloquea (default si falta `tipo`). */
export function preguntasDecisivas(sets: SetsRubrica, categoria: string): PreguntaRubrica[] {
    return preguntasActivas(sets, categoria).filter((p) => p.tipo === "decisiva");
}

/**
 * La categoría cumple si TODAS sus preguntas DECISIVAS están en preguntasCumplidas.
 * Las de contexto se reportan pero no bloquean. Si la categoría no tiene decisivas
 * activas, basta el 0/1 del modelo (defensivo).
 */
export function cumpleCategoria(
    sets: SetsRubrica,
    categoria: string,
    preguntasCumplidas: string[],
    votoModelo: boolean
): boolean {
    if (!votoModelo) return false;
    const decisivas = preguntasDecisivas(sets, categoria);
    if (decisivas.length === 0) return votoModelo;
    const cumplidas = new Set(preguntasCumplidas);
    return decisivas.every((p) => cumplidas.has(p.texto));
}

function construirPromptEmbudo(texto: string, categorias: string[]): string {
    // Spec 092-US2: el embudo mató la categoría correcta en el 35% del banco (70/200).
    // Se hace PERMISIVO: su trabajo es NO descartar de más; el filtro estricto
    // (preguntas decisivas) viene después y es el que decide.
    return `Eres un analista de reportes de riesgos para menores. Lee el texto y lista las categorías que podrían tener ALGUNA relación, señal o sospecha, aunque sea débil o implícita.

REGLA CLAVE: ante la duda, INCLUYE la categoría. Es mucho peor descartar una conducta real que evaluar una de más (después otro filtro estricto decide). Solo excluye una categoría si el texto claramente NO tiene nada que ver con ella.

Categorías posibles: ${categorias.join(", ")}

Texto del reporte: "${texto}"

Responde SOLO con JSON: {"categoriasPlausibles": ["CATEGORIA1", ...]} (vacío solo si el texto no trata de ninguna conducta de riesgo en absoluto).`;
}

function construirPromptVoto(texto: string, sets: SetsRubrica, categorias: string[]): string {
    const bloques = categorias
        .map((cat) => {
            const activas = preguntasActivas(sets, cat);
            const lineas = activas
                .map((p, i) => {
                    const tipo = p.tipo === "decisiva" ? "DECISIVA" : "contexto";
                    return `  ${i + 1}. [${tipo}] ${p.texto}`;
                })
                .join("\n");
            return `- ${cat}:\n${lineas}`;
        })
        .join("\n");
    return `Eres un evaluador ESTRICTO de reportes de riesgos para menores. Evalúa el texto con la rúbrica de cada categoría.

REGLAS OBLIGATORIAS:
- Las preguntas marcadas [DECISIVA] son el núcleo de la conducta: marca 1 SOLO si TODAS las decisivas se cumplen con evidencia CLARA en el texto. Ante la duda en una decisiva, marca 0.
- Las preguntas [contexto] NO son obligatorias: no bloquean la categoría, pero repórtalas si se cumplen.
- Denegar por defecto en las decisivas: la ausencia de evidencia es 0, nunca 1.
- Las preguntas son factuales y específicas: "¿se COMPARTIÓ?" no es lo mismo que "¿se pidió?". No confundas categorías.
- En "preguntasCumplidas" copia VERBATIM el texto de las preguntas que se cumplen (decisivas y de contexto).

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

/** Ejecuta SOLO el embudo (spec 092-US2: medición independiente). */
export async function evaluarEmbudo(
    texto: string,
    config?: Partial<ConfigRubrica>
): Promise<{ plausibles: string[]; fallback: boolean }> {
    const cfg: ConfigRubrica = { ...(await cargarConfigRubrica()), ...config };
    const categoriasPosibles = Object.keys(cfg.preguntas).filter((cat) => preguntasActivas(cfg.preguntas, cat).length > 0);
    try {
        const embudo = await llamarOllamaStructured<{ categoriasPlausibles: string[] }>(
            cfg.modeloEmbudo,
            construirPromptEmbudo(texto, categoriasPosibles),
            embudoSchema,
            "Eres un analista estricto de reportes.",
            { temperature: cfg.temperatura }
        );
        return { plausibles: embudo.data.categoriasPlausibles.filter((c) => categoriasPosibles.includes(c)), fallback: false };
    } catch {
        return { plausibles: categoriasPosibles, fallback: true };
    }
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

    // Spec 092-US2: red de seguridad — si el embudo queda casi vacío, evaluar todo.
    if (plausibles.length < 2) {
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
                    const preguntasCumplidas = v?.preguntasCumplidas ?? [];
                    // Spec 092-US1: cumple solo si TODAS las decisivas están cumplidas
                    categorias[cat] = {
                        cumple: cumpleCategoria(cfg.preguntas, cat, preguntasCumplidas, v?.cumple === 1),
                        preguntasCumplidas,
                    };
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

    // Spec 092-US3: SIN "principal" por gravedad. Se muestran TODAS las conductas
    // que superan el umbral. La gravedad ya no decide nada de cara al usuario.
    const presentes = Object.entries(porcentajes)
        .filter(([, pct]) => pct >= cfg.umbralPresencia)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([cat]) => cat);

    // Decisión: ≥1 presente → PROCESADO (CLASIFICADO); ninguna → revisión humana (desacuerdo).
    // `categoria` (campo requerido por schema) = la de mayor %; OTRO si no hay ninguna.
    const categoriaFinal = (presentes[0] ?? "OTRO") as CategoriaConducta;
    const estado: EstadoReporte = presentes.length === 0 ? "REVISION_MANUAL" : "CLASIFICADO";
    const confianza = presentes.length > 0 ? (porcentajes[presentes[0]] ?? 0) : 0;
    const categoriasSecundarias = presentes
        .filter((cat) => cat !== categoriaFinal)
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
