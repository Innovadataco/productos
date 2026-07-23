import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    // La CSP se emite ÚNICAMENTE en src/middleware.ts (nonce por petición — fix I-12);
    // dos fuentes emitiendo CSP se pisan. Aquí quedan solo los demás headers de seguridad.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
