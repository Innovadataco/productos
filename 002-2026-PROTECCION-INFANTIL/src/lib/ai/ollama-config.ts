import { prisma } from "@/lib/prisma";

const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

/**
 * Resuelve la URL base de Ollama. El parámetro de sistema `system.ollama_base_url`
 * tiene prioridad; si no existe o está vacío, se usa la variable de entorno
 * OLLAMA_BASE_URL o el default localhost.
 */
export async function getOllamaBaseUrl(): Promise<string> {
    try {
        const param = await prisma.parametroSistema.findUnique({
            where: { clave: "system.ollama_base_url" },
        });
        if (param?.valor) return param.valor.trim();
    } catch {
        // Fallback silencioso si la tabla no está disponible (muy temprano en startup)
    }
    return DEFAULT_OLLAMA_BASE_URL;
}

export function getDefaultOllamaBaseUrl(): string {
    return DEFAULT_OLLAMA_BASE_URL;
}

export interface OllamaModelInfo {
    name: string;
    tag: string;
    size: number;
    modifiedAt: string;
    esEmbedding: boolean;
}

function parseModelName(name: string): { name: string; tag: string } {
    const idx = name.lastIndexOf(":");
    if (idx <= 0) return { name, tag: "latest" };
    return { name: name.slice(0, idx), tag: name.slice(idx + 1) };
}

export function isEmbeddingModel(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.includes("embed") || lower === "nomic-embed-text";
}

/**
 * Consulta /api/tags en el servidor Ollama configurado.
 */
export async function listOllamaModels(baseUrl?: string): Promise<OllamaModelInfo[]> {
    const url = baseUrl || (await getOllamaBaseUrl());
    const res = await fetch(`${url}/api/tags`, {
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "unknown");
        throw new Error(`Ollama no responde (${res.status}): ${text}`);
    }
    const data = (await res.json()) as {
        models?: { name: string; size?: number; modified_at?: string; digest?: string }[];
    };
    const models = data.models || [];
    return models.map((m) => {
        const parsed = parseModelName(m.name);
        return {
            name: parsed.name,
            tag: parsed.tag,
            size: m.size ?? 0,
            modifiedAt: m.modified_at ?? new Date().toISOString(),
            esEmbedding: isEmbeddingModel(parsed.name),
        };
    });
}

/**
 * Valida que una URL de Ollama cumpla R2: solo localhost o IPs privadas.
 * Acepta: localhost, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
 *         100.64.0.0/10 (Tailscale), ::1.
 */
export function isLocalOllamaUrl(urlStr: string): boolean {
    let url: URL;
    try {
        url = new URL(urlStr);
    } catch {
        return false;
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "::1" || hostname === "127.0.0.1") return true;

    const parts = hostname.split(".").map((p) => parseInt(p, 10));
    if (parts.length === 4 && parts.every((p) => Number.isFinite(p) && p >= 0 && p <= 255)) {
        const [a, b, c] = parts;
        if (a === 10) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 127) return true;
        if (a === 100 && b >= 64 && b <= 127) return true;
    }
    return false;
}
