/**
 * El pedido al SDMX público de BanRep (fase C, C2c), desde el Mac del dueño. Uno solo por corrida, por
 * pedirBytesAcotado (src/lib/http-acotado.ts): sin seguir redirecciones, con plazo total y tope de bytes (el del lector
 * XML). Sin User-Agent propio ni nada que imite un navegador, sin reintentos ni cookies: NADA SE EVADE. Si BanRep
 * bloquea, el dueño abre la misma URL en su navegador, resuelve el desafío él mismo y repite con --archivo.
 * - BANREP_BLOQUEADO: un 403 o un 429 (detalle HTTP_<n>) o un tipo de contenido que no es XML, como la página del
 *   captcha (detalle TIPO; el cuerpo no se lee). Una redirección al desafío llega como BANREP_RED (fetch rechaza con
 *   `redirect: "error"`): el reporte lo dice.
 * - Lo demás queda como lo da pedirBytesAcotado: BANREP_RED, BANREP_HTTP_<n> (un 500 HTML puede ser caída o bloqueo: no
 *   se adivina) y BANREP_FORMATO (vacío o más grande que el tope).
 * Nunca lanza.
 */
import { pedirBytesAcotado, type BuscarHttp } from "../../lib/http-acotado";
import { TOPES_XML } from "../../lib/xml-acotado";
import { falloBanrep, urlBanrep, type CodigoBanrep, type FalloBanrep, type SerieBanrep } from "./banrep-series";

/** POR VERIFICAR: el Accept que da 200 (lo pedido en JSON o CSV da 406; el XML respondió el 2026-11-21). */
export const ACCEPT_BANREP = "application/vnd.sdmx.genericdata+xml;version=2.1, application/xml;q=0.9";
/** Los tipos de un SDMX-ML genérico. POR VERIFICAR: cuál manda BanRep en una respuesta buena. */
export const TIPOS_SDMX: readonly string[] = Object.freeze(["application/vnd.sdmx.genericdata+xml", "application/xml", "text/xml"]);
/** El tope del cuerpo es el del lector XML: lo que pase de ahí no se podría leer. */
export const BYTES_MAXIMOS_BANREP = TOPES_XML.bytes;
/** Cada pedido tardó de 6 a 9 s el 2026-11-21 (la TPM desde 2000 pesó 1,75 MB). 60 s, con margen: POR VERIFICAR. */
export const TIEMPO_MAXIMO_BANREP_MS = 60_000;
const PREFIJO = "BANREP";
const ESTADOS_DE_BLOQUEO: ReadonlySet<string> = new Set([`${PREFIJO}_HTTP_403`, `${PREFIJO}_HTTP_429`]);

export type PedidoBanrep = { readonly ok: true; readonly bytes: Uint8Array } | FalloBanrep;

/** Los bytes del SDMX del dataflow de `serie` desde el año de `desde`, o el fallo. No lanza. */
export async function pedirSdmxBanrep(serie: SerieBanrep, desde: Date, buscar: BuscarHttp): Promise<PedidoBanrep> {
  const r = await pedirBytesAcotado(buscar, urlBanrep(serie, desde), {
    prefijo: PREFIJO,
    headers: { Accept: ACCEPT_BANREP },
    bytesMaximos: BYTES_MAXIMOS_BANREP,
    tiempoMaximoMs: TIEMPO_MAXIMO_BANREP_MS,
    tiposAceptados: TIPOS_SDMX,
  });
  if (r.ok) return r;
  if (r.codigo === `${PREFIJO}_TIPO`) return falloBanrep("BANREP_BLOQUEADO", "TIPO");
  if (ESTADOS_DE_BLOQUEO.has(r.codigo)) return falloBanrep("BANREP_BLOQUEADO", r.codigo.slice(PREFIJO.length + 1));
  return falloBanrep(r.codigo as CodigoBanrep);
}
