/**
 * Los hosts de Yahoo del ciclo intradía: una lista blanca FIJA de dos (query1 y query2). Lo único que va por configuración es
 * cuál de los dos usa el ciclo (INV_INTRADIA_HOST_YAHOO = query1 o query2); la URL ya no es libre. El buscador fijo del servicio
 * toma de aquí sus hosts de Yahoo. `urlBaseYahoo` normaliza una URL base: https, sin credenciales, sin puerto, ruta ni consulta,
 * y con uno de esos dos hosts (nunca una IP ni otro nombre); la barra final se quita.
 */

/** Los dos hosts de Yahoo que el ciclo intradía puede usar, por su selector. Lista fija: no se amplía por configuración. */
export const HOSTS_YAHOO_INTRADIA = Object.freeze({
  query1: "query1.finance.yahoo.com",
  query2: "query2.finance.yahoo.com",
} as const);
export type SelectorHostYahoo = keyof typeof HOSTS_YAHOO_INTRADIA;

/** La URL base normalizada («https://host», sin barra final), o null si no cumple. */
export function urlBaseYahoo(texto: string): string | null {
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return null;
  }
  const limpia = u.protocol === "https:" && u.username === "" && u.password === "" && u.port === "" && u.search === "" && u.hash === "" && (u.pathname === "/" || u.pathname === "");
  // Solo los hosts de la lista fija (nunca una IP ni otro nombre), aunque no se pase por el despachador ni por la configuración.
  const permitido = (Object.values(HOSTS_YAHOO_INTRADIA) as string[]).includes(u.hostname);
  return limpia && permitido ? `https://${u.hostname}` : null;
}
