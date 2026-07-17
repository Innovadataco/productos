/**
 * Cliente HTTP para Ollama local
 * Logging explícito de cada llamada (modelo, tokens, latencia, éxito/fracaso)
 */

import { getOllamaBaseUrl } from "./ollama-config";

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

export async function llamarOllama(
    modelo: string,
    prompt: string,
    system?: string,
    options?: Record<string, unknown>,
    keepAlive?: number
): Promise<{ response: string; metrics: OllamaMetrics }> {
    const startTime = Date.now();

    const body: Record<string, unknown> = {
        model: modelo,
        prompt,
        stream: false,
        options: {
            temperature: 0,
            seed: 42,
            ...options,
        },
    };
    if (system) body.system = system;
    if (keepAlive !== undefined) body.keep_alive = keepAlive;

    const ollamaBaseUrl = await getOllamaBaseUrl();
    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const latenciaMs = Date.now() - startTime;

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        console.error(`[OLLAMA] ERROR modelo=${modelo} status=${response.status} latencia=${latenciaMs}ms errorLen=${errorText.length}`);
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

    console.log(`[OLLAMA] OK modelo=${modelo} latencia=${latenciaMs}ms promptTokens=${metrics.promptTokens} responseTokens=${metrics.responseTokens}`);

    return { response: data.response, metrics };
}

/**
 * Llama a Ollama con structured output nativo (JSON Schema) usando /api/generate.
 * Requiere Ollama >= 0.29.0 y un modelo que soporte `format` con schema.
 *
 * Nota: algunos modelos con thinking mode (ej. Qwen3/ornith) devuelven el JSON
 * forzado por el schema en el campo `thinking` en lugar de `response`. Esta
 * función intenta primero `response` y, si está vacío, lee `thinking`.
 */
export async function llamarOllamaStructured<T>(
    modelo: string,
    prompt: string,
    schema: Record<string, unknown>,
    system?: string,
    options?: Record<string, unknown>,
    keepAlive?: number
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
    if (keepAlive !== undefined) body.keep_alive = keepAlive;

    const ollamaBaseUrl = await getOllamaBaseUrl();
    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const latenciaMs = Date.now() - startTime;

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        console.error(`[OLLAMA_STRUCTURED] ERROR modelo=${modelo} status=${response.status} latencia=${latenciaMs}ms errorLen=${errorText.length}`);
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
        console.error(`[OLLAMA_STRUCTURED] JSON inválido modelo=${modelo} latencia=${latenciaMs}ms responseLen=${rawResponse.length}`);
        throw new Error("Ollama devolvió JSON inválido a pesar del schema");
    }

    console.log(`[OLLAMA_STRUCTURED] OK modelo=${modelo} latencia=${latenciaMs}ms promptTokens=${metrics.promptTokens} responseTokens=${metrics.responseTokens}`);

    return { data: parsed, rawResponse, metrics };
}
