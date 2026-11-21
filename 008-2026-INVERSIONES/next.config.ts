import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad en TODAS las rutas (D-014, requisito #7): las de PI
 * (002-2026-PROTECCION-INFANTIL/next.config.ts), con estas diferencias a propósito:
 * - Referrer-Policy `no-referrer` (PI: strict-origin-when-cross-origin): lo pide la spec de Inversiones.
 * - HSTS siempre (PI lo condiciona a ENABLE_HTTPS_HEADERS): aquí no hay variables que aflojen la
 *   seguridad, y sobre http local el navegador lo ignora.
 * - X-Robots-Tag `noindex, nofollow`: el portafolio no se indexa.
 * La CSP va con nonce por pedido en src/proxy.ts (no aquí: una CSP estática no puede llevar nonce).
 * Cache-Control: las páginas son dinámicas (Next ya manda no-store) y las API lo ponen explícito.
 */
const CABECERAS_DE_SEGURIDAD = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  // Imagen de producción liviana (docker-compose.prod.yml llegará en su SPEC).
  output: "standalone",
  poweredByHeader: false,
  // `next dev` no escribe instrucciones para agentes de IA en AGENTS.md (ese archivo tiene dueño).
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: CABECERAS_DE_SEGURIDAD }];
  },
};

export default nextConfig;
