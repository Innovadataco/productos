import { NextRequest, NextResponse } from "next/server";

/**
 * Barrera de acceso a las páginas (spec 005, US-4 — cierra I-008).
 *
 * **Comprobación optimista** (D-041): mira si la cookie de sesión está presente
 * y nada más. No verifica la firma ni consulta la base de datos, así que el
 * secreto de firma no viaja hasta aquí.
 *
 * La frontera de seguridad NO es este archivo: es `verifyAuth()` en cada ruta
 * de la API (constitución §5.1), que es lo que cierra esta misma spec. Esta
 * barrera resuelve un problema de navegación —que el usuario sepa que no ha
 * entrado— y por eso puede permitirse ser optimista. Una cookie caducada deja
 * renderizar la página: lo que verá es una pantalla vacía, porque ninguna de
 * sus peticiones obtendrá datos.
 */

/** Rutas servidas siempre, con sesión o sin ella (§5.1 + excepción declarada). */
const RUTAS_PUBLICAS = [
  "/login",
  "/api/auth/login",
  // Solo borra la cookie: exigir sesión para cerrarla no aporta seguridad y
  // dejaría encerrado a quien tiene la sesión caducada.
  "/api/auth/logout",
];

function esPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // La pantalla de acceso se sirve SIEMPRE, haya cookie o no (D-043): apartar de
  // ella a quien "parece" tener sesión encerraría fuera justo a quien la tiene
  // caducada, que es quien necesita volver a entrar.
  if (esPublica(pathname)) return NextResponse.next();

  const haySesion = Boolean(req.cookies.get("token")?.value);
  if (haySesion) return NextResponse.next();

  // A la API nunca se le redirige: un `fetch` seguiría la redirección y recibiría
  // el HTML del login con estado 200, que la interfaz tomaría por datos válidos.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const destino = req.nextUrl.clone();
  destino.pathname = "/login";
  destino.search = "";
  destino.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(destino);
}

export const config = {
  // Se excluyen los recursos del framework y el icono del sitio: sin esto, la
  // propia pantalla de acceso no podría cargar sus estáticos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
