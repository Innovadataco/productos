const DEFAULT_OLLAMA_BASE_URL = "http://100.91.87.86:11435";
const MODELO_EMBEDDING = "nomic-embed-text";
const TIMEOUT_MS = 5000;

export async function vectorizar(texto: string): Promise<number[] | null> {
    if (!texto || typeof texto !== "string") return null;
    const base = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const res = await fetch(`${base}/api/embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: MODELO_EMBEDDING, prompt: texto }),
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        const data = (await res.json()) as { embedding?: number[] };
        if (!Array.isArray(data.embedding)) return null;
        return data.embedding;
    } catch {
        return null;
    }
}
