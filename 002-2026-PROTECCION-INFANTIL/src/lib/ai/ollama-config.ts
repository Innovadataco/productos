import { getParametroSistema } from "../parametros";
import { MODELO_EMBEDDING_DEFAULT } from "./defaults";

const FALLBACK_OLLAMA_BASE_URL = "http://localhost:11435";

/**
 * E-6: validación fail-fast de la URL base de Ollama. Antes una URL malformada
 * se descubría tarde, como un fetch opaco contra un destino inválido; ahora el
 * error es claro y sale en el punto de uso.
 */
function validarUrlOllama(valor: string, origen: string): string {
    let url: URL;
    try {
        url = new URL(valor);
    } catch {
        throw new Error(`[Ollama] URL base inválida (${origen}): "${valor}" — se espera http(s)://host[:puerto]`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`[Ollama] URL base con protocolo no soportado (${origen}): "${valor}" — solo http/https`);
    }
    return valor;
}

/**
 * Timeout por defecto para las llamadas de generación a Ollama (ms).
 *
 * SPEC-807: bajado de 120 s a 60 s, y el número NO es a ojo. Nuestra propia vigilancia ya declara que
 * 60 s es una FALLA de Ollama: `monitoreo.ollama.smoke.timeout_ms = 60000`. Esperar 120 s en el camino
 * de la petición es el DOBLE de lo que nuestro monitor acepta antes de dar la dependencia por caída —
 * sostener una llamada colgada 120 s solo retiene recursos (conexiones) más allá de cuando ya la
 * consideramos muerta. Cuando el trabajo que la usa corre FUERA de la petición (SPEC-807), puede tardar
 * lo que necesite sin bloquear a nadie; lo que NO puede es quedar colgado para siempre.
 *
 * NOTA (carril del CEO): el valor VIVO en producción es el parámetro `ia.ollama.timeout_ms = 120000`,
 * que tiene prioridad sobre este default. Bajar este default solo cambia entornos sin el parámetro
 * (tests / nuevos); para que prod use 60 s hay que bajar ese parámetro (y la semilla), que es del CEO/Datos.
 */
const DEFAULT_OLLAMA_TIMEOUT_MS = 60_000;

/**
 * Resuelve el timeout (ms) para los fetch de generación a Ollama. El parámetro
 * `ia.ollama.timeout_ms` (entero > 0) tiene prioridad; si no existe, está
 * vacío o es inválido, se usa el default. Fallback silencioso si la tabla de
 * parámetros no está disponible (muy temprano en startup), igual que
 * getOllamaBaseUrl.
 */
export async function getOllamaTimeoutMs(): Promise<number> {
    try {
        const param = await getParametroSistema("ia.ollama.timeout_ms");
        const valor = param?.valor ? Number(param.valor) : NaN;
        if (Number.isFinite(valor) && valor > 0) return Math.floor(valor);
    } catch {
        // Fallback silencioso si la tabla no está disponible
    }
    return DEFAULT_OLLAMA_TIMEOUT_MS;
}

/**
 * Resuelve la URL base de Ollama. El parámetro de sistema `system.ollama_base_url`
 * tiene prioridad; si no existe o está vacío, se usa la variable de entorno
 * OLLAMA_BASE_URL o el default localhost. E-6: el env se lee EN CADA llamada (un
 * cambio no exige reinicio) y la URL se valida siempre (fail-fast con error claro
 * si es inválida, tanto del parámetro como del env).
 */
export async function getOllamaBaseUrl(): Promise<string> {
    let paramValor: string | null = null;
    try {
        const param = await getParametroSistema("system.ollama_base_url");
        paramValor = param?.valor?.trim() || null;
    } catch {
        // Fallback silencioso si la tabla no está disponible (muy temprano en startup)
    }
    if (paramValor) return validarUrlOllama(paramValor, "parametro system.ollama_base_url");
    return validarUrlOllama(process.env.OLLAMA_BASE_URL || FALLBACK_OLLAMA_BASE_URL, "OLLAMA_BASE_URL");
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
