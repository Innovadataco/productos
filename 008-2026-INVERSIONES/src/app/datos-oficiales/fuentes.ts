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

/** El enlace tal cual si es https a un host de la lista (por defecto, la de las fuentes), sin usuario ni puerto; si no, null. */
export function enlaceSeguro(href: string, hosts: ReadonlySet<string> = HOSTS_FUENTES): string | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const limpio = u.protocol === "https:" && hosts.has(u.hostname) && u.username === "" && u.password === "" && u.port === "";
  return limpio ? href : null;
}

/** La página oficial de una fuente del catálogo (sfc:…, banrep:… o dane:…), o null si no tiene. */
export function enlaceDeFuente(fuente: string): string | null {
  const href = ENLACES.get(fuente);
  return href === undefined ? null : enlaceSeguro(href);
}

// ───────────── La referencia oficial de un decreto (frente datos-oficiales-decretos-pantalla, C6b) ─────────────

/**
 * Los hosts de las referencias https que acepta C1 (dividendo_decretado_referencia_chk; REFERENCIAS_OFICIALES de
 * src/datos-oficiales/decretos/filas.ts, que no se importa aquí). Una prueba los ata: tests/unit/pantalla-datos-oficiales/fuentes.test.ts.
 */
export const HOSTS_REFERENCIAS: ReadonlySet<string> = new Set(["www.superfinanciera.gov.co", "www.bvc.com.co"]);

/** El radicado de la SFC, con el mismo patrón de C1. */
const RADICADO_SFC = /^sfc:([A-Za-z0-9._-]{1,60})$/;

export type ReferenciaPintada =
  | { readonly tipo: "ENLACE"; readonly href: string }
  | { readonly tipo: "RADICADO"; readonly radicado: string }
  | { readonly tipo: "TEXTO"; readonly texto: string };

/** Enlace solo si es https a la SFC o a la BVC (validado otra vez al pintar); el radicado y lo demás, texto. */
export function referenciaOficial(referencia: string): ReferenciaPintada {
  const href = enlaceSeguro(referencia, HOSTS_REFERENCIAS);
  if (href !== null) return { tipo: "ENLACE", href };
  const radicado = RADICADO_SFC.exec(referencia)?.[1];
  return radicado === undefined ? { tipo: "TEXTO", texto: referencia } : { tipo: "RADICADO", radicado };
}
