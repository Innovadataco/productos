/**
 * La URL base de Yahoo del ciclo intradía, que va por configuración (INV_INTRADIA_URL_YAHOO; desacople de PI y del VPS: ningún
 * destino fijo escrito en el servicio, salvo el valor por omisión). Solo se acepta lo que el buscador fijo del servicio
 * también aceptaría: https, sin credenciales, sin puerto, sin ruta ni consulta, y con un nombre (nunca una IP). La barra final se quita.
 */

import { isIP } from "node:net";

/** Un nombre de servidor con puntos, en minúsculas: la misma regla que aplica el buscador fijo a los hosts extra. */
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
