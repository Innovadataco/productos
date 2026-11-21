/**
 * Cookies de la sesión y de la pre-sesión (D-014 y TOTP). Fuente única de sus atributos: la creación y el
 * borrado llevan los mismos (el prefijo `__Host-` exige Secure, Path=/ y ningún Domain; un borrado sin
 * ellos lo rechaza el navegador y la cookie sigue viva). Secure siempre, sin excepción de desarrollo: en
 * local, Chrome trata a 127.0.0.1 y localhost como contexto seguro (`npm run dev`); para Safari,
 * `npm run dev:https`. La pre-sesión (clave correcta, falta el TOTP) tiene su propia cookie: el proxy y la
 * revalidación solo leen `__Host-sesion`. Módulo puro: lo usa también el proxy.
 */
import { PRESESION_SEGUNDOS, SESION_SEGUNDOS } from "./limites";

export const NOMBRE_COOKIE = "__Host-sesion";
export const NOMBRE_PRESESION = "__Host-presesion";

const ATRIBUTOS = "Path=/; HttpOnly; Secure; SameSite=Strict";
/** Un JWT es base64url con puntos: cualquier otra cosa podría romper la cabecera Set-Cookie. */
const VALOR_SEGURO = /^[A-Za-z0-9._-]+$/;
const BORRADO = "Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

function crear(nombre: string, token: string, segundos: number): string {
  if (!VALOR_SEGURO.test(token)) throw new Error("Valor de cookie inválido.");
  return `${nombre}=${token}; ${ATRIBUTOS}; Max-Age=${segundos}`;
}

export const cookieDeSesion = (token: string): string => crear(NOMBRE_COOKIE, token, SESION_SEGUNDOS);
export const cookieDeBorrado = (): string => `${NOMBRE_COOKIE}=; ${ATRIBUTOS}; ${BORRADO}`;

export const cookieDePresesion = (token: string): string => crear(NOMBRE_PRESESION, token, PRESESION_SEGUNDOS);
export const cookieDeBorradoPresesion = (): string => `${NOMBRE_PRESESION}=; ${ATRIBUTOS}; ${BORRADO}`;

/** El valor de la cookie `nombre` de la cabecera Cookie, por nombre EXACTO (`x__Host-sesion` no cuenta). */
export function leerToken(cabecera: string | null, nombre: string = NOMBRE_COOKIE): string | undefined {
  if (!cabecera) return undefined;
  for (const parte of cabecera.split(";")) {
    const i = parte.indexOf("=");
    if (i === -1 || parte.slice(0, i).trim() !== nombre) continue;
    const valor = parte.slice(i + 1).trim();
    return valor || undefined;
  }
  return undefined;
}
