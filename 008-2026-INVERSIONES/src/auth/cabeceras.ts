/**
 * CSP con nonce por pedido (D-014, requisito #7). Las directivas son las de PI
 * (002-2026-PROTECCION-INFANTIL/middleware.ts), con los scripts SOLO por nonce y `strict-dynamic` en
 * toda la app (en PI eso aplica al área privada; aquí todo es privado salvo el acceso).
 * - `style-src 'unsafe-inline'`, como PI: el tablero usa `style={}` (atributos), que un nonce no cubre.
 * - `'unsafe-eval'` solo en desarrollo: lo exige `next dev`.
 * - `upgrade-insecure-requests` fuera de desarrollo: producción va siempre por https (túnel).
 * Las demás cabeceras (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, X-Robots-Tag)
 * van en next.config.ts. Módulo puro: lo usa el proxy.
 */
const NONCE_BYTES = 16;

const COMUNES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "media-src 'self'",
];

export function generarNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function politicaCsp(nonce: string, desarrollo: boolean): string {
  const scripts = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? " 'unsafe-eval'" : ""}`;
  return [COMUNES[0], scripts, ...COMUNES.slice(1), ...(desarrollo ? [] : ["upgrade-insecure-requests"])].join("; ");
}
