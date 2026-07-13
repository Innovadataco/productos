const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

export async function generarEmbedding(modelo: string, texto: string): Promise<number[]> {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelo, prompt: texto }),
        signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`[EMBED] Ollama error HTTP ${res.status}: ${err}`);
    }

    const data = (await res.json()) as { embedding?: number[] };
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
        throw new Error(`[EMBED] Respuesta inválida de Ollama: embedding vacío o mal formado`);
    }

    console.log(`[EMBED] OK modelo=${modelo} dims=${data.embedding.length}`);
    return data.embedding;
}