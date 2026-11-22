/**
 * Respuestas JSON del login y del proxy: siempre `Cache-Control: no-store` (nada de la sesión se guarda
 * en cachés) y, si hace falta, varias Set-Cookie (el segundo paso crea la sesión y borra la pre-sesión en
 * la misma respuesta). Módulo puro: lo usa también el proxy.
 */
export const MENSAJE_GENERICO = "Usuario o contraseña incorrectos";

/** Un solo mensaje para todo fallo del segundo paso: código errado, repetido, de recuperación usado o bloqueo. */
export const MENSAJE_SEGUNDO_PASO = "Código incorrecto";

/** La pre-sesión venció, se reemplazó o no llegó: hay que volver a pasar la clave. */
export const MENSAJE_PRESESION_VENCIDA = "La verificación venció. Ingrese de nuevo.";

/**
 * El enrolamiento solo vale 30 min después del enlace o de `--reiniciar-totp` (decisión D1). Sirve al dueño y al
 * familiar (la pre-sesión no dice el rol): cada uno con su salida.
 */
export const MENSAJE_FUERA_DE_PLAZO =
  "Pasaron más de 30 minutos desde que se definió la clave. Dueño: pida un enlace nuevo con crear-acceso-inicial o corra crear-acceso-inicial --reiniciar-totp. Familiar: pídale al dueño un enlace nuevo.";

/** Un familiar (solo lectura) pidió algo que escribe o administra: es solo del dueño (src/auth/sesion.ts). */
export const MENSAJE_SOLO_LECTURA = "Solo lectura: esta acción es solo del dueño.";

export function respuestaJson(
  cuerpo: unknown,
  estado: number,
  cabeceras: Readonly<Record<string, string>> = {},
  cookies: readonly string[] = [],
): Response {
  const h = new Headers(cabeceras);
  h.set("Cache-Control", "no-store");
  for (const cookie of cookies) h.append("Set-Cookie", cookie);
  return Response.json(cuerpo, { status: estado, headers: h });
}
