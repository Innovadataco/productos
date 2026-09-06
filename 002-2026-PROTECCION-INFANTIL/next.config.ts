import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Spec 097: build standalone para la imagen Docker de producción (no afecta dev).
    output: "standalone",
    // 002-PI-051 (B2): el proxy trunca el body a 10MB por defecto y el multipart de la
    // evidencia de apelación llegaba corrupto a request.formData() (el usuario veía
    // "La solicitud debe ser multipart/form-data" en vez del 413 por tamaño). Con 25MB
    // la validación real queda en la ruta (parámetro apelacion.max_tamano_documento_mb,
    // default 5MB → 413 limpio).
    experimental: {
        proxyClientMaxBodySize: "25mb",
    },
    async headers() {
        const enableHttpsHeaders = process.env.ENABLE_HTTPS_HEADERS === "true";

        const cspDirectives = [
            "default-src 'self'",
            process.env.NODE_ENV === "production"
                ? "script-src 'self' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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

        if (enableHttpsHeaders) {
            cspDirectives.push("upgrade-insecure-requests");
        }

        const headersSeguridad = [
            {
                key: "X-Frame-Options",
                value: "DENY",
            },
            {
                key: "X-Content-Type-Options",
                value: "nosniff",
            },
            {
                key: "Referrer-Policy",
                value: "strict-origin-when-cross-origin",
            },
            {
                key: "Permissions-Policy",
                value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
            },
        ];

        if (enableHttpsHeaders) {
            headersSeguridad.push({
                key: "Strict-Transport-Security",
                value: "max-age=63072000; includeSubDomains; preload",
            });
        }

        return [
            {
                // Headers de seguridad para todo (HSTS incluido si está activo).
                source: "/:path*",
                headers: headersSeguridad,
            },
            {
                // E-6 P4c: el CSP estático NO aplica al área privada `/dashboard/**` — esa
                // área la sirve el middleware (middleware.ts en la raíz, SPEC-287) con nonce
                // por request (prod). Si ambos emitieran el mismo header habría duplicado.
                // SPEC-531: excluir por SEGMENTO (`dashboard` seguido de `/` o fin), no por
                // prefijo. El `(?!dashboard)` anterior también excluía la PÚBLICA
                // `/dashboard-publico`, dejándola sin CSP estática y a merced del nonce del
                // middleware (que su HTML prerenderizado no lleva) → scripts bloqueados.
                source: "/((?!dashboard(?:/|$)).*)",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: cspDirectives.join("; "),
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
