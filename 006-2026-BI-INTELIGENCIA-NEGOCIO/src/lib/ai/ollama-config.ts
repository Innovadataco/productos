// src/lib/ai/ollama-config.ts · Configuración y guards del cliente Ollama
// Producto 006 · BI v2 · Admin IA
// Adaptado de PI (002 · src/lib/ai/ollama-config.ts, referencia SOLO LECTURA)
// al patrón del 006: parámetro en BD (bi_config vía getConfig) → env → default.
// Ollama vive en la Mac Studio y se alcanza vía Tailscale (OLLAMA_BASE_URL).
// R2: NUNCA se sondea una URL pública — isLocalOllamaUrl es OBLIGATORIO antes
// de cualquier sondeo y las funciones de este módulo que pegan a la red lo
// aplican siempre (fail-closed), aunque la capa API lo vuelva a chequear.

import { getConfig } from "../config";

/** Último eslabón si no hay parámetro en BD ni env: Ollama local de desarrollo. */
const FALLBACK_OLLAMA_BASE_URL = "http://localhost:11435";

/**
 * Timeout por defecto para las llamadas de generación a Ollama (ms).
 * 120 s: generoso frente a la latencia real de modelos grandes en la Mac
 * Studio para no introducir abortos espurios; acota la espera si un modelo
 * queda colgado. Configurable con el parámetro `ia.ollama.timeout_ms`.
 */
const DEFAULT_OLLAMA_TIMEOUT_MS = 120_000;

/** Modelo NL→SQL por defecto si no hay parámetro en BD ni env LLM_MODEL_SQL. */
const DEFAULT_MODELO_SQL = "qwen2.5:14b";

/** Modelo de embeddings conocido (paridad con PI · src/lib/ai/defaults.ts). */
const MODELO_EMBEDDING_DEFAULT = "nomic-embed-text";

/**
 * Validación fail-fast de la URL base de Ollama: una URL malformada se
 * descubre aquí con un error claro, no tarde como un fetch opaco contra
 * un destino inválido.
 */
function validarUrlOllama(valor: string, origen: string): string {
    let url: URL;
    try {
        url = new URL(valor);
    } catch {
        throw new Error(`[OLLAMA] URL base inválida (${origen}): "${valor}" — se espera http(s)://host[:puerto]`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`[OLLAMA] URL base con protocolo no soportado (${origen}): "${valor}" — solo http/https`);
    }
    return valor;
}

/**
 * Resuelve la URL base de Ollama. Prioridad: parámetro en BD
 * `system.ollama_base_url` → env OLLAMA_BASE_URL → default localhost.
 * El env se lee EN CADA llamada (un cambio no exige reinicio) y la URL se
 * valida siempre (fail-fast con error claro si es inválida, venga del
 * parámetro o del env). Fallback silencioso si la tabla bi_config no está
 * disponible todavía (muy temprano en startup).
 */
export async function getOllamaBaseUrl(): Promise<string> {
    let paramValor: string | null = null;
    try {
        paramValor = (await getConfig("system.ollama_base_url"))?.trim() || null;
    } catch {
        // Fallback silencioso si la tabla no está disponible (muy temprano en startup)
    }
    if (paramValor) return validarUrlOllama(paramValor, "parametro system.ollama_base_url");
    return validarUrlOllama(process.env.OLLAMA_BASE_URL || FALLBACK_OLLAMA_BASE_URL, "OLLAMA_BASE_URL");
}

/**
 * Resuelve el timeout (ms) para los fetch de generación a Ollama. El
 * parámetro `ia.ollama.timeout_ms` (entero > 0) tiene prioridad; si no
 * existe, está vacío o es inválido, se usa el default. Fallback silencioso
 * si la tabla no está disponible, igual que getOllamaBaseUrl.
 */
export async function getOllamaTimeoutMs(): Promise<number> {
    try {
        const valor = Number(await getConfig("ia.ollama.timeout_ms"));
        if (Number.isFinite(valor) && valor > 0) return Math.floor(valor);
    } catch {
        // Fallback silencioso si la tabla no está disponible
    }
    return DEFAULT_OLLAMA_TIMEOUT_MS;
}

/**
 * Resuelve el modelo de chat/NL→SQL vigente. Prioridad: parámetro en BD
 * `ia.ollama.modelo_sql` → env LLM_MODEL_SQL → default. La página Admin IA
 * cambia el modelo escribiendo el parámetro; el env es el piso de arranque.
 */
export async function getModeloSql(): Promise<string> {
    try {
        const valor = (await getConfig("ia.ollama.modelo_sql"))?.trim();
        if (valor) return valor;
    } catch {
        // Fallback silencioso si la tabla no está disponible
    }
    return process.env.LLM_MODEL_SQL?.trim() || DEFAULT_MODELO_SQL;
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
    return lower.includes("embed") || lower === MODELO_EMBEDDING_DEFAULT;
}

/**
 * Consulta /api/tags en el servidor Ollama configurado (sondeo de modelos).
 * R2: valida que la URL sea local ANTES de sondear, aunque venga dada por
 * parámetro — nunca se sondea una URL pública ni una enviada por el cliente.
 */
export async function listOllamaModels(baseUrl?: string): Promise<OllamaModelInfo[]> {
    const url = baseUrl || (await getOllamaBaseUrl());
    assertUrlOllamaLocal(url);
    const res = await fetch(`${url}/api/tags`, {
        signal: AbortSignal.timeout(10_000),
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
 * R2 fail-closed: lanza si la URL de Ollama no es local. OBLIGATORIO antes
 * de cualquier sondeo o generación; lo aplican las funciones de este módulo
 * y de ollama-client, y la capa API puede re-aplicarlo para devolver 400.
 */
export function assertUrlOllamaLocal(url: string): void {
    if (!isLocalOllamaUrl(url)) {
        throw new Error(`[OLLAMA] URL no local rechazada (R2): "${url}" — solo localhost, IPs privadas o Tailscale (100.64.0.0/10)`);
    }
}

/**
 * Valida que una URL de Ollama cumpla R2: solo localhost o IPs privadas.
 * Acepta: localhost, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
 *         100.64.0.0/10 (Tailscale), ::1.
 * Copiado verbatim de PI (002 · src/lib/ai/ollama-config.ts).
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
