/**
 * Cliente HTTP para Ollama local
 * Logging explícito de cada llamada (modelo, tokens, latencia, éxito/fracaso)
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
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

export async function llamarOllama(
    modelo: string,
    prompt: string,
    system?: string
): Promise<{ response: string; metrics: OllamaMetrics }> {
    const startTime = Date.now();

    const body: Record<string, unknown> = {
        model: modelo,
        prompt,
        stream: false,
    };
    if (system) body.system = system;

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
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
        totalDuration: data.total_duration ?? null,
    };

    console.log(`[OLLAMA] OK modelo=${modelo} latencia=${latenciaMs}ms promptTokens=${metrics.promptTokens} responseTokens=${metrics.responseTokens}`);

    return { response: data.response, metrics };
}

export interface OllamaMetrics {
    modelo: string;
    latenciaMs: number;
    promptTokens: number | null;
    responseTokens: number | null;
    totalDuration: number | null;
}