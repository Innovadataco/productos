// SPEC-030 · resolución endurecida del host base de BI.
// En producción NUNCA devuelve una URL localhost en silencio: si falta el
// proxy-header y la env, lanza en vez de degradar (la lección del incidente
// de deploy donde BI_BASE_URL ausente generó returnTo=localhost en prod).

// Acepta cualquier fuente con `.get(name)`: tanto `headers()` de next/headers
// (ReadonlyHeaders) como `req.headers` (Headers) lo cumplen.
export type HeaderSource = { get(name: string): string | null };

function stripTrailingSlash(u: string): string {
    return u.endsWith("/") ? u.slice(0, -1) : u;
}

// Un host se considera "local" si apunta a la propia máquina. En producción
// jamás debe ser el host base público (sería la degradación silenciosa que
// este SPEC elimina).
function esHostLocal(host: string): boolean {
    const soloHost = host.split(":")[0]?.trim().toLowerCase() ?? "";
    return (
        soloHost === "localhost" ||
        soloHost === "127.0.0.1" ||
        soloHost === "0.0.0.0" ||
        soloHost === "::1"
    );
}

/**
 * Resuelve el host base público de BI en 3 niveles:
 *   1. x-forwarded-host (+ x-forwarded-proto si viene · default https) —
 *      el proxy real en prod (Cloudflare Tunnel). Verificado en D-029.6
 *      que estos headers SÍ llegan al Server Component de Next.js 15.
 *   2. process.env.BI_BASE_URL — configuración explícita.
 *   3. NODE_ENV === "production" → THROW visible · localhost solo en dev.
 *
 * Nunca devuelve una URL localhost en producción de forma silenciosa.
 */
export function resolveBiBaseUrl(h: HeaderSource): string {
    // Nivel 1 · proxy real. Basta x-forwarded-host; el proto se toma del
    // header si viene (primer valor de una posible lista "https,http" tras
    // varios proxies) y default https si el proxy no lo mandó (D-030.6).
    const fwdHostRaw = h.get("x-forwarded-host");
    if (fwdHostRaw) {
        const host = fwdHostRaw.split(",")[0]?.trim();
        // D-030.8 · en producción un x-forwarded-host localhost NO es el host
        // público (es un request que no pasó por el túnel Cloudflare: curl
        // directo al contenedor, healthcheck, etc. — Next inyecta el socket
        // local). Devolverlo sería la misma degradación silenciosa a localhost
        // que este SPEC elimina, solo movida del Nivel 3 al Nivel 1. En ese
        // caso caemos al Nivel 2 (env, bien seteado en prod). Fuera de
        // producción sí aceptamos localhost (es el dev normal).
        if (host && !(process.env.NODE_ENV === "production" && esHostLocal(host))) {
            const fwdProtoRaw = h.get("x-forwarded-proto");
            const proto =
                fwdProtoRaw?.split(",")[0]?.trim() || "https";
            return stripTrailingSlash(`${proto}://${host}`);
        }
    }

    // Nivel 2 · configuración explícita.
    const env = process.env.BI_BASE_URL;
    if (env && env.trim().length > 0) return stripTrailingSlash(env.trim());

    // Nivel 3 · fallo visible en producción · localhost solo en dev.
    if (process.env.NODE_ENV === "production") {
        throw new Error(
            "[SPEC-030] BI_BASE_URL no resuelto: falta x-forwarded-host y BI_BASE_URL en producción",
        );
    }
    return "http://localhost:3001";
}
