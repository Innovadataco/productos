import { NextResponse, type NextRequest } from "next/server";

/// CSP con nonce por petición (fix I-12). Next App Router entrega el payload RSC en <script>
/// inline: sin nonce (y sin 'unsafe-inline', que está PROHIBIDO), el navegador los bloquea,
/// `window.__next_f` queda vacío y React nunca hidrata. El nonce debe viajar en el header
/// Content-Security-Policy de la PETICIÓN (via `request.headers`) — así es como Next lo detecta
/// y lo estampa en sus <script> inline — y también en la respuesta, que es la CSP que aplica
/// el navegador. La CSP se emite SOLO aquí (se retiró de next.config.ts para no tener dos
/// fuentes pisándose); los demás headers de seguridad siguen en next.config.ts.
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // 'unsafe-eval' SOLO en desarrollo (lo necesita el HMR de Turbopack); en producción no va.
  const esDev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${esDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const cabecerasPeticion = new Headers(request.headers);
  cabecerasPeticion.set("x-nonce", nonce);
  cabecerasPeticion.set("Content-Security-Policy", csp);

  const respuesta = NextResponse.next({ request: { headers: cabecerasPeticion } });
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

export const config = {
  matcher: [
    // Todas las páginas pasan por el middleware; se excluyen estáticos/assets y prefetch.
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
