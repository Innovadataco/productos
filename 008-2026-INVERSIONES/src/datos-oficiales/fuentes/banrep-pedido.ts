/**
 * El pedido al SDMX público de BanRep (fase C, C2c), desde el Mac del dueño. Uno solo por corrida, por
 * pedirBytesAcotado (src/lib/http-acotado.ts): sin seguir redirecciones, con plazo total y tope de bytes (el del lector
 * XML). Sin User-Agent propio ni nada que imite un navegador, sin reintentos ni cookies: NADA SE EVADE. Si BanRep
 * bloquea, el dueño abre la misma URL en su navegador, resuelve el desafío él mismo y repite con --archivo.
 * - BANREP_BLOQUEADO: una página HTML en vez del XML (content-type text/html o XHTML: detalle HTML; el cuerpo no se lee)
 *   o un 403 o un 429 (detalle HTTP_<n>). Una redirección al desafío llega como BANREP_RED (fetch rechaza con
 *   `redirect: "error"`): el reporte lo dice.
 * - BANREP_TIPO: otro tipo de contenido que no es XML ni HTML, o un charset distinto de UTF-8 (no se adivina un bloqueo).
 *   Para saberlo se mira solo el encabezado content-type de la respuesta, sin tocar el cuerpo.
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
const TIPOS_HTML: ReadonlySet<string> = new Set(["text/html", "application/xhtml+xml"]);

export type PedidoBanrep = { readonly ok: true; readonly bytes: Uint8Array } | FalloBanrep;

type Entorno = Readonly<Record<string, string | undefined>>;

/**
 * ¿El entorno apaga la verificación del certificado (Node la apaga con NODE_TLS_REJECT_UNAUTHORIZED exactamente «0»)?
 * Entonces un intermediario podría servir una serie falsa que el lector no distingue: el exportador no pide así.
 */
export function tlsDesactivado(entorno: Entorno): boolean {
  return entorno.NODE_TLS_REJECT_UNAUTHORIZED === "0";
}

const esHtml = (contentType: string | null): boolean => TIPOS_HTML.has((contentType ?? "").split(";")[0]!.trim().toLowerCase());

/** Los bytes del SDMX del dataflow de `serie` desde el año de `desde`, o el fallo. No lanza. */
export async function pedirSdmxBanrep(serie: SerieBanrep, desde: Date, buscar: BuscarHttp): Promise<PedidoBanrep> {
  // Solo se anota el content-type que llegó (para distinguir una página HTML de otro tipo); la respuesta pasa intacta.
  const visto: { contentType: string | null } = { contentType: null };
  const anotando: BuscarHttp = async (url, init) => {
    const respuesta = await buscar(url, init);
    visto.contentType = respuesta.headers.get("content-type");
    return respuesta;
  };
  const r = await pedirBytesAcotado(anotando, urlBanrep(serie, desde), {
    prefijo: PREFIJO,
    headers: { Accept: ACCEPT_BANREP },
    bytesMaximos: BYTES_MAXIMOS_BANREP,
    tiempoMaximoMs: TIEMPO_MAXIMO_BANREP_MS,
    tiposAceptados: TIPOS_SDMX,
  });
  if (r.ok) return r;
  if (r.codigo === `${PREFIJO}_TIPO`) return esHtml(visto.contentType) ? falloBanrep("BANREP_BLOQUEADO", "HTML") : falloBanrep("BANREP_TIPO");
  if (ESTADOS_DE_BLOQUEO.has(r.codigo)) return falloBanrep("BANREP_BLOQUEADO", r.codigo.slice(PREFIJO.length + 1));
  return falloBanrep(r.codigo as CodigoBanrep);
}
