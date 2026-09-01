// src/lib/ai/ollama-client.ts · Cliente HTTP para Ollama (Mac Studio vía Tailscale)
// Producto 006 · BI v2 · Admin IA
// Adaptado de PI (002 · src/lib/ai/ollama-client.ts, referencia SOLO LECTURA).
// Logging explícito de cada llamada (modelo, tokens, latencia, éxito/fracaso)
// con prefijo [OLLAMA] — el 006 no tiene lib/logger: console.error/warn.
// R2: antes de CUALQUIER generación se exige URL local (assertUrlOllamaLocal).

import { assertUrlOllamaLocal, getOllamaBaseUrl, getOllamaTimeoutMs } from "./ollama-config";

// Ollama devuelve duraciones en nanosegundos; normalizamos a milisegundos
// para mantener consistencia con latenciaMs.
function nsToMs(ns: number | undefined): number | null {
    if (ns === undefined || ns === null) return null;
    return ns / 1_000_000;
}

interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    thinking?: string;
    done: boolean;
    done_reason?: string;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}

export interface OllamaMetrics {
    modelo: string;
    latenciaMs: number;
    promptTokens: number | null;
    responseTokens: number | null;
    totalDuration: number | null;
    loadDuration: number | null;
}

export interface ResultadoPruebaModelo {
    respuesta: string;
    metrics: OllamaMetrics;
}

/**
 * Prueba un modelo con un prompt libre (playground Admin IA): POST
 * /api/generate con stream:false y opciones deterministas (temperature 0,
 * seed 42). Devuelve la respuesta en texto y las métricas de la llamada.
 *
 * Nota: modelos con thinking mode (Qwen3 y similares) pueden devolver el
 * texto en el campo `thinking` cuando `response` sale vacío — mismo
 * fallback que PI.
 */
export async function probarModelo(modelo: string, prompt: string): Promise<ResultadoPruebaModelo> {
    const inicio = Date.now();
    const baseUrl = await getOllamaBaseUrl();
    assertUrlOllamaLocal(baseUrl);
    const timeoutMs = await getOllamaTimeoutMs();

    const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: modelo,
            prompt,
            stream: false,
            options: { temperature: 0, seed: 42 },
        }),
        signal: AbortSignal.timeout(timeoutMs),
    });

    const latenciaMs = Date.now() - inicio;

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        console.error(`[OLLAMA] ERROR probarModelo modelo=${modelo} status=${response.status} latencia=${latenciaMs}ms errorLen=${errorText.length}`);
        throw new Error(`Ollama HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OllamaResponse;

    const metrics: OllamaMetrics = {
        modelo,
        latenciaMs,
        promptTokens: data.prompt_eval_count ?? null,
        responseTokens: data.eval_count ?? null,
        totalDuration: nsToMs(data.total_duration),
        loadDuration: nsToMs(data.load_duration),
    };

    const respuesta = data.response?.trim() || data.thinking?.trim() || "";

    console.warn(`[OLLAMA] OK probarModelo modelo=${modelo} latencia=${latenciaMs}ms promptTokens=${metrics.promptTokens} responseTokens=${metrics.responseTokens}`);

    return { respuesta, metrics };
}

/**
 * Llama a Ollama con structured output nativo (JSON Schema) usando
 * /api/generate (Fase 2 · motor NL→SQL). Requiere Ollama >= 0.29.0 y un
 * modelo que soporte `format` con schema. Misma lógica que PI: opciones
 * deterministas por defecto (temperature 0, seed 42), fallback al campo
 * `thinking` si `response` sale vacío, y error claro si el JSON no parsea
 * (se tira la salida; NO se rescata a la fuerza — candado 2).
 */
export async function llamarOllamaStructured<T>(
    modelo: string,
    prompt: string,
    schema: Record<string, unknown>,
    system?: string,
    options?: Record<string, unknown>
): Promise<{ data: T; rawResponse: string; metrics: OllamaMetrics }> {
    const startTime = Date.now();

    const body: Record<string, unknown> = {
        model: modelo,
        prompt,
        stream: false,
        format: schema,
        options: {
            temperature: 0,
            seed: 42,
            ...options,
        },
    };
    if (system) body.system = system;

    const ollamaBaseUrl = await getOllamaBaseUrl();
    assertUrlOllamaLocal(ollamaBaseUrl);
    const timeoutMs = await getOllamaTimeoutMs();
    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
    });

    const latenciaMs = Date.now() - startTime;

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        console.error(`[OLLAMA] ERROR structured modelo=${modelo} status=${response.status} latencia=${latenciaMs}ms errorLen=${errorText.length}`);
        throw new Error(`Ollama HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OllamaResponse;

    const metrics: OllamaMetrics = {
        modelo,
        latenciaMs,
        promptTokens: data.prompt_eval_count ?? null,
        responseTokens: data.eval_count ?? null,
        totalDuration: nsToMs(data.total_duration),
        loadDuration: nsToMs(data.load_duration),
    };

    const rawResponse = data.response?.trim() || data.thinking?.trim() || "";

    let parsed: T;
    try {
        parsed = JSON.parse(rawResponse) as T;
    } catch {
        console.error(`[OLLAMA] JSON inválido structured modelo=${modelo} latencia=${latenciaMs}ms responseLen=${rawResponse.length}`);
        throw new Error("Ollama devolvió JSON inválido a pesar del schema");
    }

    console.warn(`[OLLAMA] OK structured modelo=${modelo} latencia=${latenciaMs}ms promptTokens=${metrics.promptTokens} responseTokens=${metrics.responseTokens}`);

    return { data: parsed, rawResponse, metrics };
}
