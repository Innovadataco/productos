/**
 * Proxy de Next 16 (antes `middleware.ts`, deprecado en 16) · login de Inversiones (D-014).
 * En cada pedido que no es estático, en este orden:
 *   1. /api/*: tope general por IP (60 por minuto) → 429 con Retry-After.
 *   2. Métodos que no son GET/HEAD: Origin de la lista permitida (CSRF) → 403.
 *   3. Rutas públicas (src/auth/rutas.ts): pasan.
 *   4. Sesión: firma y vencimiento del JWT de `__Host-sesion`. Sin sesión: páginas → /ingresar
 *      (borrando una cookie inválida) y API → 401. Sin secreto válido → 503 (falla cerrada).
 * Todo lo que pasa lleva la CSP con nonce. El proxy NO lee la base: cada página y API revalida la
 * sesión contra ella (`exigirSesion` / `exigirSesionApi`). Sin variables que lo apaguen.
 */
import { NextResponse, type NextRequest } from "next/server";
import { generarNonce, politicaCsp } from "./auth/cabeceras";
import { NOMBRE_COOKIE, cookieDeBorrado } from "./auth/cookie";
import { ipDeSolicitud, redDeIp } from "./auth/ip";
import { API_POR_MINUTO, VENTANA_API_MS } from "./auth/limites";
import { crearLimitador } from "./auth/limite-api";
import { origenValido, origenesPermitidos } from "./auth/origen";
import { esApi, esPublica } from "./auth/rutas";
import { claveDeSesion } from "./auth/secreto";
import { verificarToken } from "./auth/token";

const limitadorApi = crearLimitador({ maximo: API_POR_MINUTO, ventanaMs: VENTANA_API_MS });
const SIN_CACHE = { "Cache-Control": "no-store" } as const;
const RUTA_INGRESO = "/ingresar";

const json = (cuerpo: unknown, estado: number, cabeceras: Record<string, string> = {}): NextResponse =>
  NextResponse.json(cuerpo, { status: estado, headers: { ...SIN_CACHE, ...cabeceras } });

function pasar(pedido: NextRequest): NextResponse {
  const nonce = generarNonce();
  const csp = politicaCsp(nonce, process.env.NODE_ENV === "development");
  const cabeceras = new Headers(pedido.headers);
  cabeceras.set("x-nonce", nonce);
  cabeceras.set("Content-Security-Policy", csp);
  const respuesta = NextResponse.next({ request: { headers: cabeceras } });
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

/** En producción, la base de la redirección es APP_ORIGEN (validada); nunca el Host que mande el cliente. */
function baseDeRedireccion(pedido: NextRequest): string {
  return process.env.NODE_ENV === "production" ? (origenesPermitidos(process.env)[0] ?? pedido.url) : pedido.url;
}

function sinSesion(pedido: NextRequest, habiaCookie: boolean): NextResponse {
  const respuesta = esApi(pedido.nextUrl.pathname)
    ? json({ error: "No autenticado" }, 401)
    : NextResponse.redirect(new URL(RUTA_INGRESO, baseDeRedireccion(pedido)), { status: 307, headers: SIN_CACHE });
  if (habiaCookie) respuesta.headers.append("Set-Cookie", cookieDeBorrado());
  return respuesta;
}

function topeDeApi(pedido: NextRequest): NextResponse | null {
  if (!esApi(pedido.nextUrl.pathname)) return null;
  const red = redDeIp(ipDeSolicitud(pedido.headers)) ?? "sin-ip";
  const decision = limitadorApi.registrar(red, Date.now());
  return decision.permitido ? null : json({ error: "Demasiadas solicitudes" }, 429, { "Retry-After": String(decision.reintentarEnS) });
}

function origenRechazado(pedido: NextRequest): NextResponse | null {
  try {
    return origenValido(pedido.method, pedido.headers, origenesPermitidos(process.env)) ? null : json({ error: "Origen no permitido" }, 403);
  } catch {
    // Producción sin APP_ORIGEN válida: no se puede verificar el Origin, así que nada pasa.
    return json({ error: "Configuración incompleta" }, 503);
  }
}

export async function proxy(pedido: NextRequest): Promise<NextResponse> {
  const frenado = topeDeApi(pedido) ?? origenRechazado(pedido);
  if (frenado) return frenado;
  if (esPublica(pedido.method, pedido.nextUrl.pathname)) return pasar(pedido);

  let clave: Uint8Array;
  try {
    clave = claveDeSesion();
  } catch {
    console.error("[proxy] sin secreto de sesión válido: no pasa nada protegido");
    return json({ error: "Servicio no disponible" }, 503);
  }
  const token = pedido.cookies.get(NOMBRE_COOKIE)?.value;
  const sesion = token ? await verificarToken(token, clave, Date.now()) : null;
  return sesion ? pasar(pedido) : sinSesion(pedido, token !== undefined);
}

export const config = {
  // Todo menos los estáticos de Next y el favicon, con la exclusión anclada (`/favicon.icox` o
  // `/_next/staticx` sí pasan por el proxy). Las rutas con punto también exigen sesión.
  matcher: ["/((?!_next/static/|_next/image$|favicon\\.ico$).*)"],
};
