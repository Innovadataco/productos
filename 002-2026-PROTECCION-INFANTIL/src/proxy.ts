import { NextRequest, NextResponse } from "next/server";
import { proxy as proxyCore } from "./lib/proxy";

/**
 * E-6 P4c: CSP con nonce SOLO para `/dashboard/**` (área privada dinámica — las
 * páginas dashboard se renderizan por request con sesión; verificado: ninguna es
 * SSG). Las páginas públicas (SSG) conservan el CSP actual de next.config con
 * `unsafe-inline` (aceptado por ZEUS; el render dinámico de públicas es deuda
 * futura = E-6b).
 *
 * Patrón oficial de Next 16: el middleware genera un nonce CSPRNG por request
 * (Web Crypto, edge-safe), lo propaga en los request headers (`x-csp-nonce` y el
 * propio CSP) para que Next extraiga el nonce del CSP del request header y lo
 * aplique a sus propios scripts al renderizar (getScriptNonceFromHeader), y sirve
 * la respuesta con `script-src 'self' 'nonce-<v>' 'strict-dynamic'`.
 *
 * En desarrollo /dashboard conserva el CSP de hoy (`unsafe-eval` para HMR) — el
 * nonce solo endurece producción. El núcleo de autorización (`src/lib/proxy.ts`,
 * D-36) no se toca: esto es una envoltura de headers sobre su decisión.
 */

const CSP_DIRECTIVAS_COMUNES = [
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "media-src 'self'",
];

function buildCsp(nonce: string, esProduccion: boolean): string {
    const scriptSrc = esProduccion
        ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    const directivas = ["default-src 'self'", scriptSrc, ...CSP_DIRECTIVAS_COMUNES];
    if (process.env.ENABLE_HTTPS_HEADERS === "true") {
        directivas.push("upgrade-insecure-requests");
    }
    return directivas.join("; ");
}

function generarNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
    const response = await proxyCore(request);

    // Solo /dashboard/** lleva CSP con nonce; el resto conserva el de next.config.
    if (!request.nextUrl.pathname.startsWith("/dashboard")) {
        return response;
    }

    const nonce = generarNonce();
    const csp = buildCsp(nonce, process.env.NODE_ENV === "production");

    // El "paso libre" del núcleo es un NextResponse.next() (lleva x-middleware-next):
    // se reconstruye pasándole los request headers con el nonce y el CSP, para que
    // el render de Next propague el nonce a sus propios scripts del HTML.
    if (response.headers.get("x-middleware-next") === "1") {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-csp-nonce", nonce);
        requestHeaders.set("Content-Security-Policy", csp);
        const paso = NextResponse.next({ request: { headers: requestHeaders } });
        paso.headers.set("Content-Security-Policy", csp);
        return paso;
    }

    // Redirects (p. ej. /dashboard sin sesión → /login) y errores JSON del núcleo.
    response.headers.set("Content-Security-Policy", csp);
    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
        "/reportar",
    ],
};
