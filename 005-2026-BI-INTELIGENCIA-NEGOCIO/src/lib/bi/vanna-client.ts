import type { VotoJurado } from "./tipos";

const DEFAULT_VANNA_BASE_URL = "http://bi-vanna:8001";
const TIMEOUT_MS = 60_000;

export interface RespuestaVanna {
    sqlGenerado?: string;
    votosJurado: VotoJurado[];
    consenso: boolean;
    razon?: string;
    latencias?: Record<string, number>;
    error?: string;
}

export interface EntradaVanna {
    preguntaNL: string;
    schemaJSON: object;
    contexto?: Record<string, unknown>;
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
            return {
                consenso: false,
                votosJurado: [],
                error: `vanna_http_${res.status}`,
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
