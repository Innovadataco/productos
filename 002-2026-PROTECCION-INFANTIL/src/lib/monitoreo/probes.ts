/**
 * SPEC-171 (Pilar B, I-51) — Probes del vigilante de infraestructura.
 * Funciones puras: cada una mide UNA señal y devuelve su resultado sin
 * persistir nada (la persistencia y el ciclo de vida del incidente viven en
 * `incidentes.ts`). Los parámetros llegan por argumento para testabilidad;
 * el caller (`scripts/monitor-probes.mjs`) los relee de ParametroSistema en
 * cada ciclo.
 *
 * Señales: app | worker | bd | ollama_ping | ollama_smoke | tailscale.
 */
import { prisma } from "@/lib/prisma";
import { getParametroSistema } from "@/lib/parametros";
import { leerHeartbeatWorker } from "@/lib/worker-heartbeat";

export const SENALES_MONITOREO = ["app", "worker", "bd", "ollama_ping", "ollama_smoke", "tailscale"] as const;
export type SenalMonitoreo = (typeof SENALES_MONITOREO)[number];

export interface ResultadoProbe {
    ok: boolean;
    latenciaMs: number;
    detalle?: string;
}

function mensajeError(error: unknown): string {
    const msg = error instanceof Error ? error.message : String(error);
    // Acota el detalle persistido (timeouts de undici pueden ser verbosos).
    return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}

/**
 * App Next.js: GET ${url}/api/health/worker (misma ruta que usa el
 * healthcheck de dev-restart.sh). Ok si HTTP 200.
 */
export async function probeApp({ url, timeoutMs = 5000 }: { url: string; timeoutMs?: number }): Promise<ResultadoProbe> {
    const inicio = Date.now();
    try {
        const res = await fetch(`${url}/api/health/worker`, { signal: AbortSignal.timeout(timeoutMs) });
        const latenciaMs = Date.now() - inicio;
        return res.ok
            ? { ok: true, latenciaMs }
            : { ok: false, latenciaMs, detalle: `HTTP ${res.status}` };
    } catch (error) {
        return { ok: false, latenciaMs: Date.now() - inicio, detalle: mensajeError(error) };
    }
}

/**
 * Worker de reportes: reutiliza `leerHeartbeatWorker` (spec 143): ok si el
 * archivo worker.heartbeat tiene un latido de hace ≤ heartbeatMaxSeg segundos.
 * Es una lectura de archivo local; latenciaMs queda en 0 (no aplica).
 */
export function probeWorker({ heartbeatMaxSeg }: { heartbeatMaxSeg: number }): ResultadoProbe {
    const latido = leerHeartbeatWorker();
    if (!latido) return { ok: false, latenciaMs: 0, detalle: "sin archivo de heartbeat del worker" };
    const edadSeg = Math.max(0, Math.floor((Date.now() - latido.getTime()) / 1000));
    return edadSeg <= heartbeatMaxSeg
        ? { ok: true, latenciaMs: 0, detalle: `último latido hace ${edadSeg}s` }
        : { ok: false, latenciaMs: 0, detalle: `sin latido hace ${edadSeg}s (máx ${heartbeatMaxSeg}s)` };
}

/** PostgreSQL: ok si `SELECT 1` no lanza. */
export async function probeBd(): Promise<ResultadoProbe> {
    const inicio = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { ok: true, latenciaMs: Date.now() - inicio };
    } catch (error) {
        return { ok: false, latenciaMs: Date.now() - inicio, detalle: mensajeError(error) };
    }
}

/** Ollama vivo: GET ${baseUrl}/api/tags, ok si HTTP 200. */
export async function probeOllamaPing({ baseUrl, timeoutMs = 5000 }: { baseUrl: string; timeoutMs?: number }): Promise<ResultadoProbe> {
    const inicio = Date.now();
    try {
        const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
        const latenciaMs = Date.now() - inicio;
        return res.ok
            ? { ok: true, latenciaMs }
            : { ok: false, latenciaMs, detalle: `HTTP ${res.status}` };
    } catch (error) {
        return { ok: false, latenciaMs: Date.now() - inicio, detalle: mensajeError(error) };
    }
}

/**
 * Ollama de verdad genera: POST /api/generate con una generación mínima.
 * El modelo es el VIGENTE DEL MOTOR (primer elemento de `ia.rubrica.modelos`,
 * decisión ZEUS — nunca un modelo fijo). Si no hay modelo vigente válido, el
 * probe falla con detalle "sin modelo vigente configurado".
 */
export async function probeOllamaSmoke({ baseUrl, timeoutMs }: { baseUrl: string; timeoutMs: number }): Promise<ResultadoProbe> {
    const inicio = Date.now();
    let paramModelos;
    try {
        paramModelos = await getParametroSistema("ia.rubrica.modelos");
    } catch (error) {
        return { ok: false, latenciaMs: 0, detalle: `error leyendo ia.rubrica.modelos: ${mensajeError(error)}` };
    }
    let modelo: string | null = null;
    try {
        const parsed: unknown = paramModelos ? JSON.parse(paramModelos.valor) : null;
        if (Array.isArray(parsed) && typeof parsed[0] === "string" && parsed[0].trim().length > 0) {
            modelo = parsed[0].trim();
        }
    } catch {
        modelo = null;
    }
    if (!modelo) {
        return { ok: false, latenciaMs: 0, detalle: "sin modelo vigente configurado" };
    }
    try {
        const res = await fetch(`${baseUrl}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: modelo, prompt: "Responde solo: ok", stream: false, options: { num_predict: 5 } }),
            signal: AbortSignal.timeout(timeoutMs),
        });
        const latenciaMs = Date.now() - inicio;
        if (!res.ok) return { ok: false, latenciaMs, detalle: `HTTP ${res.status} (modelo ${modelo})` };
        const data = (await res.json()) as { response?: unknown };
        const texto = typeof data.response === "string" ? data.response.trim() : "";
        return texto.length > 0
            ? { ok: true, latenciaMs, detalle: `modelo ${modelo}` }
            : { ok: false, latenciaMs, detalle: `respuesta vacía del modelo ${modelo}` };
    } catch (error) {
        return { ok: false, latenciaMs: Date.now() - inicio, detalle: `${mensajeError(error)} (modelo ${modelo})` };
    }
}

/**
 * Túnel Tailscale: sin URL configurada no aplica (ok con detalle "no-aplica";
 * el estado NO_APLICA del tablero se resuelve en el endpoint). Con URL, ok si
 * responde CUALQUIER status < 500 (un 401/404 igual prueba que la punta vive).
 */
export async function probeTailscale({ url, timeoutMs = 8000 }: { url: string; timeoutMs?: number }): Promise<ResultadoProbe> {
    if (!url.trim()) return { ok: true, latenciaMs: 0, detalle: "no-aplica" };
    const inicio = Date.now();
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        const latenciaMs = Date.now() - inicio;
        return res.status < 500
            ? { ok: true, latenciaMs, detalle: `HTTP ${res.status}` }
            : { ok: false, latenciaMs, detalle: `HTTP ${res.status}` };
    } catch (error) {
        return { ok: false, latenciaMs: Date.now() - inicio, detalle: mensajeError(error) };
    }
}
