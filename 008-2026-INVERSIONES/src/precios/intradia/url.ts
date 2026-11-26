/**
 * Los hosts de Yahoo del ciclo intradía: una lista blanca FIJA de dos (query1 y query2). Lo único que va por configuración es
 * cuál de los dos usa el ciclo (INV_INTRADIA_HOST_YAHOO = query1 o query2); la URL ya no es libre. El buscador fijo del servicio
 * toma de aquí sus hosts de Yahoo. `urlBaseYahoo` normaliza una URL base: https, sin credenciales, sin puerto, ruta ni consulta,
 * y con un nombre (nunca una IP); la barra final se quita.
 */

import { isIP } from "node:net";

/** Los dos hosts de Yahoo que el ciclo intradía puede usar, por su selector. Lista fija: no se amplía por configuración. */
export const HOSTS_YAHOO_INTRADIA = Object.freeze({
  query1: "query1.finance.yahoo.com",
  query2: "query2.finance.yahoo.com",
} as const);
export type SelectorHostYahoo = keyof typeof HOSTS_YAHOO_INTRADIA;

/** Un nombre de servidor con puntos, en minúsculas: la forma que acepta `urlBaseYahoo`. */
export const NOMBRE_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** La URL base normalizada («https://host», sin barra final), o null si no cumple. */
export function urlBaseYahoo(texto: string): string | null {
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return null;
  }
  const limpia = u.protocol === "https:" && u.username === "" && u.password === "" && u.port === "" && u.search === "" && u.hash === "" && (u.pathname === "/" || u.pathname === "");
  // Una IP (v4 o v6) como nombre saltaría la validación del lookup del buscador fijo (net no resuelve una IP): solo nombres.
  const esNombre = NOMBRE_RE.test(u.hostname) && isIP(u.hostname) === 0;
  return limpia && esNombre ? `https://${u.hostname}` : null;
}
