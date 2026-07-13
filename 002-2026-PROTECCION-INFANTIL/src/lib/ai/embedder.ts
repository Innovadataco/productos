const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

export async function generarEmbedding(modelo: string, texto: string): Promise<number[]> {
    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: modelo, prompt: texto }),
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`[EMBED] Ollama error: ${err}`);
            return fallbackVector(texto);
        }

        const data = (await res.json()) as { embedding?: number[] };
        if (Array.isArray(data.embedding) && data.embedding.length > 0) {
            console.log(`[EMBED] OK modelo=${modelo} dims=${data.embedding.length}`);
            return data.embedding;
        }
    } catch (e) {
        console.error("[EMBED] Exception:", e instanceof Error ? e.message : String(e));
    }

    return fallbackVector(texto);
}

function fallbackVector(texto: string): number[] {
    const seed = hashString(texto);
    const vector: number[] = [];
    for (let i = 0; i < 768; i++) {
        vector.push(pseudoRandom(seed + i));
    }
    console.log(`[EMBED] Fallback generado dims=${vector.length}`);
    return vector;
}

function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function pseudoRandom(seed: number): number {
    const x = Math.sin(seed * 9301 + 49297) * 9301;
    return x - Math.floor(x);
}
