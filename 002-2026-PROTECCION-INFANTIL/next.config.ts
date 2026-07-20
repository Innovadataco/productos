import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

        const headers = [
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
            {
                key: "Content-Security-Policy",
                value: cspDirectives.join("; "),
            },
        ];

        if (enableHttpsHeaders) {
            headers.push({
                key: "Strict-Transport-Security",
                value: "max-age=63072000; includeSubDomains; preload",
            });
        }

        return [
            {
                source: "/:path*",
                headers,
            },
        ];
    },
};

export default nextConfig;
