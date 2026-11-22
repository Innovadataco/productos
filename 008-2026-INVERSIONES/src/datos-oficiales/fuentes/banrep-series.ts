/**
 * Las series que 008 trae del SDMX del Banco de la República (fase C, C2c): la TPM y la IBR_3M_EA. Salen del catálogo
 * (src/datos-oficiales/catalogo.ts), que es la única fuente de verdad: su `fuente` dice `banrep:<DATAFLOW>.<SUBJECT>.<UNIT>`
 * y de ahí sale qué se pide (el dataflow) y qué serie se toma del XML (SUBJECT y UNIT_MEASURE de la SeriesKey). Una
 * fuente de BanRep que no tenga esa forma deja el catálogo entero inválido: nunca se adivina qué pedir.
 * Aquí también viven los códigos y el tipo del fallo, para que argumentos y reporte no arrastren el lector XML
 * (tests/unit/lib/lectores-candado.test.ts: solo los exportadores lo alcanzan).
 */
import { CATALOGO, type SerieCatalogo } from "../catalogo";

/** El servicio SDMX público de BanRep (REST, SDMX-ML 2.1). Verificado con descargas públicas el 2026-11-21. */
export const URL_BASE_BANREP = "https://totoro.banrep.gov.co/nsi-jax-ws/rest/data";
const PREFIJO_FUENTE = "banrep:";
/** `banrep:` + dataflow (`DF_…`) + SUBJECT + UNIT_MEASURE: mayúsculas, dígitos y `_`, sin nada que cambie la URL. */
const FUENTE_BANREP = /^banrep:(DF_[A-Z0-9_]{1,40})\.([A-Z0-9_]{1,20})\.([A-Z0-9_]{1,10})$/;

export interface SerieBanrep {
  readonly codigo: string;
  readonly catalogo: SerieCatalogo;
  readonly dataflow: string;
  /** El SUBJECT de la SeriesKey. */
  readonly sujeto: string;
  /** El UNIT_MEASURE de la SeriesKey. */
  readonly unidad: string;
}

export type SeriesBanrep =
  | { readonly ok: true; readonly series: readonly SerieBanrep[] }
  | { readonly ok: false; readonly codigo: "BANREP_CATALOGO_INVALIDO" };

/**
 * Los fallos de la fuente. Los del pedido salen de pedirBytesAcotado (RED, HTTP_<n>, FORMATO, TIPO) y del bloqueo
 * (BLOQUEADO); los demás, del lector del SDMX. Ninguno lleva nada de la respuesta.
 */
export type CodigoBanrep =
  | "BANREP_RED" | `BANREP_HTTP_${number}` | "BANREP_FORMATO" | "BANREP_TIPO" | "BANREP_BLOQUEADO" | "BANREP_XML" | "BANREP_ERROR_SDMX" | "BANREP_NO_SDMX"
  | "BANREP_OTRO_DATAFLOW" | "BANREP_TRUNCADO" | "BANREP_SERIE_AUSENTE" | "BANREP_SERIE_REPETIDA" | "BANREP_SERIE_DISTINTA"
  | "BANREP_UNIDAD_DUDOSA" | "BANREP_OBS_INVALIDA" | "BANREP_AMBIGUO" | "BANREP_ERROR_INTERNO";

/**
 * `detalle` es fijo, nunca de la respuesta: «HTML» o «HTTP_403»/«HTTP_429» (bloqueo), un código XML_* del
 * lector (BANREP_XML) o el `code` numérico de un error SDMX.
 */
export interface FalloBanrep {
  readonly ok: false;
  readonly codigo: CodigoBanrep;
  readonly detalle: string | null;
}

export const falloBanrep = (codigo: CodigoBanrep, detalle: string | null = null): FalloBanrep => Object.freeze({ ok: false, codigo, detalle });

function serieDe(s: SerieCatalogo): SerieBanrep | null {
  const m = FUENTE_BANREP.exec(s.fuente);
  return m ? Object.freeze({ codigo: s.codigo, catalogo: s, dataflow: m[1]!, sujeto: m[2]!, unidad: m[3]! }) : null;
}

/** Las series del catálogo cuya fuente es de BanRep, en su orden. `catalogo` se inyecta solo en las pruebas. */
export function seriesBanrep(catalogo: readonly SerieCatalogo[] = CATALOGO): SeriesBanrep {
  const deBanrep = catalogo.filter((s) => s.fuente.startsWith(PREFIJO_FUENTE));
  const series = deBanrep.map(serieDe);
  if (series.some((s) => s === null)) return { ok: false, codigo: "BANREP_CATALOGO_INVALIDO" };
  return { ok: true, series: Object.freeze(series as SerieBanrep[]) };
}

/** La serie de BanRep con ese código exacto, o undefined (tampoco si el catálogo es inválido). */
export function serieBanrep(codigo: string, catalogo: readonly SerieCatalogo[] = CATALOGO): SerieBanrep | undefined {
  const r = seriesBanrep(catalogo);
  return r.ok ? r.series.find((s) => s.codigo === codigo) : undefined;
}

/**
 * La URL pública de la descarga: el dataflow entero (todas sus series: la que se toma se elige en el XML) desde el año
 * de `desde`. Verificado el 2026-11-21: startPeriod filtra por año. POR VERIFICAR: si acepta un día o un endPeriod (el
 * 2026-11-22 el servidor respondía 500 a todo). Es la misma URL que el dueño abre en su navegador si BanRep bloquea.
 */
export function urlBanrep(serie: SerieBanrep, desde: Date): string {
  return `${URL_BASE_BANREP}/ESTAT,${serie.dataflow},1.0/all/ALL/?startPeriod=${desde.getUTCFullYear()}`;
}
