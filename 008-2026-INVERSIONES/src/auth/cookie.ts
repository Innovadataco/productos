/**
 * Cookie de la sesión (D-014). Fuente única de sus atributos: la creación y el borrado llevan los
 * mismos (el prefijo `__Host-` exige Secure, Path=/ y ningún Domain; un borrado sin ellos lo rechaza el
 * navegador y la sesión sigue viva). Secure siempre, sin excepción de desarrollo: en local, Chrome trata
 * a 127.0.0.1 y localhost como contexto seguro (`npm run dev`); para Safari, `npm run dev:https`.
 * Módulo puro: lo usa también el proxy.
 */
import { SESION_SEGUNDOS } from "./limites";

export const NOMBRE_COOKIE = "__Host-sesion";

const ATRIBUTOS = "Path=/; HttpOnly; Secure; SameSite=Strict";
/** Un JWT es base64url con puntos: cualquier otra cosa podría romper la cabecera Set-Cookie. */
const VALOR_SEGURO = /^[A-Za-z0-9._-]+$/;

export function cookieDeSesion(token: string): string {
  if (!VALOR_SEGURO.test(token)) throw new Error("Valor de cookie inválido.");
  return `${NOMBRE_COOKIE}=${token}; ${ATRIBUTOS}; Max-Age=${SESION_SEGUNDOS}`;
}

export function cookieDeBorrado(): string {
  return `${NOMBRE_COOKIE}=; ${ATRIBUTOS}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/** El token de la cabecera Cookie, por nombre EXACTO (una cookie señuelo `x__Host-sesion` no cuenta). */
export function leerToken(cabecera: string | null): string | undefined {
  if (!cabecera) return undefined;
  for (const parte of cabecera.split(";")) {
    const i = parte.indexOf("=");
    if (i === -1 || parte.slice(0, i).trim() !== NOMBRE_COOKIE) continue;
    const valor = parte.slice(i + 1).trim();
    return valor || undefined;
  }
  return undefined;
}
