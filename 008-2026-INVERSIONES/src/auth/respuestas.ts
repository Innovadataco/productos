/**
 * Respuestas JSON del login y del proxy: siempre `Cache-Control: no-store` (nada de la sesión se guarda
 * en cachés). Módulo puro: lo usa también el proxy.
 */
export const MENSAJE_GENERICO = "Usuario o contraseña incorrectos";

export function respuestaJson(cuerpo: unknown, estado: number, cabeceras: Readonly<Record<string, string>> = {}): Response {
  return Response.json(cuerpo, { status: estado, headers: { "Cache-Control": "no-store", ...cabeceras } });
}
