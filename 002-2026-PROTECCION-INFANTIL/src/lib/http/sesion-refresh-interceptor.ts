/**
 * SPEC-400 (I-236) · PR 1 · Interceptor cliente para el refresco silencioso de
 * la cookie firmada `sesion_estado`.
 *
 * Contexto: el middleware (SPEC-572, cerrojo fail-closed) devuelve
 *   403 { error: { code: "SESION_ESTADO_REQUERIDO", ... } }
 * cuando la cookie `sesion_estado` está ausente o expiró (TTL 5 min) en una ruta
 * gateada. Este interceptor lo captura, dispara `POST /api/vigencia/refresh` una
 * sola vez (single-flight), y reintenta el request original una vez. El código
 * PROPIO lo distingue de un 403 de muro real (consent/password/vigencia), que NO
 * se reintenta — esos son bloqueos legítimos, no una cookie stale.
 *
 * Origen: SPEC-400 PR 1 traía SOLO el cliente (contra un middleware aún tolerante);
 * el cerrojo del servidor llegó en SPEC-572 (I-236) y por eso acá se pasó de 401 a 403.
 *
 * Idempotente: bandera global evita re-parchar bajo HMR o hidratación doble.
 * Solo actúa en el runtime del navegador — SSR usa otro fetch (undici) que no
 * pasa por este parche.
 */

const FLAG = "__pi_sesion_refresh_installed__";
const REFRESH_URL = "/api/vigencia/refresh";
const CODE = "SESION_ESTADO_REQUERIDO";

type FetchFn = typeof fetch;

interface GlobalsConFlag {
    [FLAG]?: true;
    [key: string]: unknown;
    fetch: FetchFn;
}

let refreshInFlight: Promise<Response> | null = null;

async function refrescarUnaSolaVez(originalFetch: FetchFn): Promise<Response> {
    if (!refreshInFlight) {
        refreshInFlight = originalFetch(REFRESH_URL, {
            method: "POST",
            credentials: "include",
        }).finally(() => {
            refreshInFlight = null;
        });
    }
    return refreshInFlight;
}

function extraerPathname(input: RequestInfo | URL): string {
    let raw: string;
    if (typeof input === "string") raw = input;
    else if (input instanceof URL) raw = input.pathname;
    else raw = input.url;
    try {
        return raw.startsWith("/") ? raw.split("?")[0] : new URL(raw).pathname;
    } catch {
        return raw;
    }
}

function esRutaRefresh(input: RequestInfo | URL): boolean {
    const pathname = extraerPathname(input);
    return pathname === REFRESH_URL;
}

async function esCandidato(res: Response): Promise<boolean> {
    // SPEC-572: el cerrojo del middleware responde 403 (SPEC-329: gateado ≠ no-autenticado).
    if (res.status !== 403) return false;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) return false;
    try {
        const cuerpo = (await res.clone().json()) as { error?: { code?: string } };
        return cuerpo?.error?.code === CODE;
    } catch {
        return false;
    }
}

/**
 * Instala el interceptor sobre `target.fetch`. Idempotente: llamadas repetidas
 * son no-op. Diseñado para llamarse una vez desde un client component del
 * layout raíz.
 */
export function installSesionRefreshInterceptor(
    target: { fetch: FetchFn; [key: string]: unknown } = globalThis as unknown as GlobalsConFlag,
): void {
    const g = target as unknown as GlobalsConFlag;
    if (g[FLAG]) return;
    if (typeof g.fetch !== "function") return;
    g[FLAG] = true;

    const original: FetchFn = g.fetch.bind(target as unknown as typeof globalThis);

    g.fetch = async function fetchConRefrescoDeSesion(
        input: RequestInfo | URL,
        init?: RequestInit,
    ): Promise<Response> {
        // Clonar Request antes del primer envío: fetch consume el body y el
        // retry pediría un stream ya leído.
        const clonParaRetry =
            typeof Request !== "undefined" && input instanceof Request ? input.clone() : null;

        const res = await original(input, init);
        // Nunca disparar el refresh al propio endpoint de refresh — bucle.
        if (esRutaRefresh(input)) return res;
        if (!(await esCandidato(res))) return res;

        const refresh = await refrescarUnaSolaVez(original);
        // Si el refresh también falló (típicamente 401 por JWT vencido), NO
        // enmascaramos el original — el llamador ve el 401 tal cual.
        if (!refresh.ok) return res;

        return original(clonParaRetry ?? input, init);
    } as FetchFn;
}

/** Solo para tests: revierte el patch. */
export function __resetSesionRefreshInterceptorParaTests(
    target: { fetch: FetchFn; [key: string]: unknown } = globalThis as unknown as GlobalsConFlag,
    fetchOriginal?: FetchFn,
): void {
    const g = target as unknown as GlobalsConFlag;
    delete g[FLAG];
    refreshInFlight = null;
    if (fetchOriginal) g.fetch = fetchOriginal;
}
