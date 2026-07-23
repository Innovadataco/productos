/**
 * Destino de retorno tras iniciar sesión (spec 005, FR-017, FR-018).
 *
 * La barrera de páginas redirige a `/login?next=<ruta solicitada>`. Ese valor
 * viene de la URL, así que es entrada del usuario: sin validarlo, la pantalla de
 * acceso serviría de trampolín a un sitio de terceros (`/login?next=https://…`).
 *
 * Solo se admiten rutas internas. Ojo con `//evil.com` y `/\evil.com`: empiezan
 * por `/` pero el navegador los resuelve como host externo.
 */
export function destinoSeguro(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
