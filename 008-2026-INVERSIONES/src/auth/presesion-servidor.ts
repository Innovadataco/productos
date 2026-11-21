import "server-only";
/**
 * La pre-sesión del lado del servidor (TOTP): la lee SOLO de `__Host-presesion` y verifica su firma, su
 * forma y su vencimiento (src/auth/presesion.ts). La regla de la base (que sea la vigente de la cuenta)
 * la aplica cada paso dentro de su transacción. Las páginas /totp y /totp/enrolar llaman a
 * `exigirPresesion()`; sus API, a `exigirPresesionApi()`. Ninguna de las dos acepta la sesión completa, y la
 * pre-sesión nunca abre las páginas o API protegidas (esas exigen `__Host-sesion`).
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NOMBRE_PRESESION, cookieDeBorradoPresesion, leerToken } from "./cookie";
import { verificarPresesion, type DatosPresesion } from "./presesion";
import { MENSAJE_PRESESION_VENCIDA, respuestaJson } from "./respuestas";
import { claveDeSesion } from "./secreto";
import { RUTA_INGRESO } from "./sesion";

/** La respuesta de una pre-sesión que no sirve: 401, pide volver a ingresar y borra la cookie. */
export const presesionVencida = (): Response =>
  respuestaJson({ error: MENSAJE_PRESESION_VENCIDA, reingresar: true }, 401, {}, [cookieDeBorradoPresesion()]);

/** La pre-sesión de la página actual, o null. Sin secreto lanza (falla cerrada). */
export async function presesionActual(): Promise<DatosPresesion | null> {
  const token = (await cookies()).get(NOMBRE_PRESESION)?.value;
  return token ? verificarPresesion(token, claveDeSesion(), Date.now()) : null;
}

/** Para las páginas del segundo paso: sin pre-sesión válida, a /ingresar. */
export async function exigirPresesion(): Promise<DatosPresesion> {
  const pre = await presesionActual();
  if (!pre) redirect(RUTA_INGRESO);
  return pre;
}

/** Para las API del segundo paso: sin pre-sesión válida, 401 que pide volver a ingresar. */
export async function exigirPresesionApi(
  pedido: Request,
): Promise<{ readonly ok: true; readonly presesion: DatosPresesion } | { readonly ok: false; readonly respuesta: Response }> {
  const token = leerToken(pedido.headers.get("cookie"), NOMBRE_PRESESION);
  const pre = token ? await verificarPresesion(token, claveDeSesion(), Date.now()) : null;
  return pre ? { ok: true, presesion: pre } : { ok: false, respuesta: presesionVencida() };
}
