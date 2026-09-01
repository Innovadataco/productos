/**
 * SPEC-342 (candado 22 v3 · calcado de SPEC-313/I-…): la base PÚBLICA para
 * redirects visibles al cliente.
 *
 * `request.url` en Next.js dentro de Docker refleja el bind interno
 * (0.0.0.0:3000), no el host público — un redirect construido con él manda al
 * navegador a `https://0.0.0.0:3000/...`: callejón "no se puede conectar".
 * Cazado en prod dos veces (SPEC-310 → SPEC-313, y ahora el rebote del camino).
 *
 * Fallback de 3 niveles: x-forwarded-host (el proxy sabe) → PI_BASE_URL (env)
 * → dominio productivo. Extraído de `api/auth/link-bi/route.ts` para que el
 * próximo redirect no lo re-invente mal.
 */
export function baseUrlPublica(request: Request): string {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    return forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : (process.env.PI_BASE_URL ?? "https://pi.innovadataco.com");
}
