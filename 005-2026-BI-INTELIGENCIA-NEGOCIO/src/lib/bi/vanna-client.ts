import type { VotoJurado } from "./tipos";

const DEFAULT_VANNA_BASE_URL = "http://bi-vanna:8001";
// 3 modelos secuenciales · cada uno hasta 90s de carga fría de Ollama.
// Ver docker/vanna/ollama_client.py DEFAULT_TIMEOUT_S.
const TIMEOUT_MS = 300_000;

export interface RespuestaVanna {
    sqlGenerado?: string;
    votosJurado: VotoJurado[];
    consenso: boolean;
    razon?: string;
    latencias?: Record<string, number>;
    error?: string;
}

/**
 * Contrato con bi-vanna FastAPI /generate.
 * El servicio Python arma el prompt y el JSON Schema internamente (candados
 * 1, 3, 4). El motor Next.js le pasa el catálogo raw con estructura
 * {tablas: [{nombre_fuente, columnas: [{nombre_fuente, tipo}]}]}.
 */
export interface CatalogoParaVanna {
    tablas: Array<{
        nombre_fuente: string;
        columnas: Array<{ nombre_fuente: string; tipo: string }>;
    }>;
}

export interface EntradaVanna {
    preguntaNL: string;
    catalogo: CatalogoParaVanna;
    contexto?: Record<string, unknown>;
    modelos?: string[];
}

export async function generarSql(entrada: EntradaVanna): Promise<RespuestaVanna> {
    const base = process.env.VANNA_BASE_URL || DEFAULT_VANNA_BASE_URL;
    try {
        const res = await fetch(`${base}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entrada),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
            const detalle = await res.text().catch(() => "");
            return {
                consenso: false,
                votosJurado: [],
                error: `vanna_http_${res.status}${detalle ? `:${detalle.slice(0, 200)}` : ""}`,
            };
        }
        return (await res.json()) as RespuestaVanna;
    } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        return {
            consenso: false,
            votosJurado: [],
            error: `vanna_unreachable:${msg}`,
        };
    }
}
