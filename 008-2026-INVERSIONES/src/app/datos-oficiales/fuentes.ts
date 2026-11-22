/**
 * Enlaces a la página oficial de cada fuente del catálogo (frente datos-oficiales-pantalla, C6a). Son páginas para
 * personas, no las API que usan los exportadores (src/datos-oficiales/fuentes/*: no se importan aquí, arrastrarían el
 * cliente HTTP). Verificadas con un GET público desde el Mac el 2026-11-22 (respondieron 200):
 * - la TRM, la ficha del dataset 32sa-8pi3 en datos.gov.co (la dirección corta /d/32sa-8pi3 redirige a esta);
 * - la TPM y la IBR, el portal de estadísticas del Banco de la República (suameca); las páginas de cada serie en
 *   www.banrep.gov.co no se pudieron verificar (devuelven un captcha a un cliente automático), así que no se enlazan;
 * - el IPC, la página del IPC del DANE.
 * Al pintar se vuelve a validar (enlaceSeguro): solo https, un host de la lista, sin usuario ni puerto. Lo que no
 * cumple queda como texto.
 */

export const HOSTS_FUENTES: ReadonlySet<string> = new Set(["www.datos.gov.co", "suameca.banrep.gov.co", "www.dane.gov.co"]);

const BANREP = "https://suameca.banrep.gov.co/estadisticas-economicas/";

const ENLACES: ReadonlyMap<string, string> = new Map([
  ["sfc:32sa-8pi3", "https://www.datos.gov.co/Econom-a-y-Finanzas/Tasa-de-Cambio-Representativa-del-Mercado-TRM/32sa-8pi3"],
  ["banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA", BANREP],
  ["banrep:DF_IBR_DAILY_HIST.IRIBRM03.ER", BANREP],
  ["dane:anex-IPC-Indices", "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc"],
]);

/** El enlace tal cual si es https a un host de la lista, sin usuario ni puerto; si no, null. */
export function enlaceSeguro(href: string): string | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const limpio = u.protocol === "https:" && HOSTS_FUENTES.has(u.hostname) && u.username === "" && u.password === "" && u.port === "";
  return limpio ? href : null;
}

/** La página oficial de una fuente del catálogo (sfc:…, banrep:… o dane:…), o null si no tiene. */
export function enlaceDeFuente(fuente: string): string | null {
  const href = ENLACES.get(fuente);
  return href === undefined ? null : enlaceSeguro(href);
}
