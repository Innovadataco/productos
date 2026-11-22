/**
 * La TRM desde la Superintendencia Financiera (datos.gov.co, dataset `32sa-8pi3`, API Socrata), fase C · C2b. Fuente
 * oficial y gratuita, sin registro ni clave. La usa SOLO el exportador del Mac (scripts/exportar-trm.ts): producción
 * no tiene red y carga el CSV canónico con `importar-series`.
 *
 * Forma verificada el 2026-11-22 con un GET al recurso (historia completa, desde 1991): un arreglo de objetos con
 * exactamente `valor` (texto decimal, 1 o 2 decimales), `unidad` ("COP"), `vigenciadesde` y `vigenciahasta`
 * (timestamp flotante `AAAA-MM-DDT00:00:00.000`), servido como `application/json;charset=utf-8`. Cada fila es una
 * vigencia cerrada en los dos extremos (de 1 a 6 días observados: fines de semana y puentes), sin huecos ni solapes;
 * la del día siguiente se publica por adelantado.
 *
 * Lectura (todo o nada, salvo los valores):
 * - Estructura rara (no es arreglo, una fila que no es objeto, una clave de más, una fecha mal escrita, el valor que no
 *   es texto o una vigencia que no toca el rango pedido): TRM_FORMATO para toda la respuesta. Llegar al límite de filas
 *   es TRM_TRUNCADO.
 * - Una unidad que no es exactamente "COP": TRM_UNIDAD. Una vigencia fuera de la forma del catálogo (de 1 a `maxDias`
 *   días): TRM_VIGENCIA. Dos vigencias que se cruzan: TRM_SOLAPE (dos filas idénticas se funden).
 * - Un valor ausente o que no es un decimal canónico de la escala y el rango del catálogo: la fila se descarta y se
 *   cuenta. Nunca se redondea (solo se quitan ceros sobrantes) y nunca pasa por Number.
 * Nunca lanza: los fallos vuelven como código. Sin Prisma: el exportador no abre la base.
 */
import { CATALOGO, type SerieCatalogo } from "../catalogo";
import { canonizarValor, compararDecimales, type ValorSerie } from "../series/csv-series";
import { leerFechaIso } from "../../importacion/trii/valores";
import { pedirBytesAcotado, type BuscarHttp } from "../../lib/http-acotado";
import { diaIso } from "../../precios/horario";

export const CODIGO_TRM = "TRM";
export const FUENTE_TRM = "sfc:32sa-8pi3";
export const URL_TRM = "https://www.datos.gov.co/resource/32sa-8pi3.json";
/** Llegar a este número de filas indica una respuesta truncada (con datos sanos no pasa: ver MAX_DIAS_RANGO_TRM). */
export const LIMITE_FILAS_TRM = 10_000;
/**
 * Rango máximo de una consulta, en días. Sin solapes, cada vigencia que toca el rango tiene al menos un día dentro:
 * hay a lo sumo MAX_DIAS_RANGO_TRM + 1 filas, por debajo del límite. La historia desde 1991 sale en dos tramos.
 */
export const MAX_DIAS_RANGO_TRM = 9_000;
/** Tope del cuerpo: medido, ~120 bytes por fila con el $select; el límite de filas cabe con margen. */
export const BYTES_MAXIMOS_TRM = 2 * 1024 * 1024;
/** Plazo total del pedido (la historia completa, ~1 MB, llega en pocos segundos desde el Mac). */
export const TIEMPO_MAXIMO_TRM_MS = 30_000;
const TIPOS_ACEPTADOS = ["application/json"] as const;
const CAMPOS = ["valor", "unidad", "vigenciadesde", "vigenciahasta"] as const;
const UNIDAD = "COP";
const DIA_MS = 86_400_000;
const TIMESTAMP_FLOTANTE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})T00:00:00(?:\.000)?$/;
/** Decimal sin signo, exponente ni separador de miles; la escala y el rango se miran contra el catálogo. */
const DECIMAL_FUENTE = /^[0-9]{1,12}(?:\.[0-9]{1,12})?$/;

export interface ConsultaTrm {
  /** Primer día del rango (medianoche UTC, fecha de negocio). */
  readonly desde: Date;
  /** Último día del rango, incluido. */
  readonly hasta: Date;
}

/** La TRM del catálogo con su forma de vigencia (TRAMO de hasta `maxDias` días). */
export interface SerieTrm {
  readonly serie: SerieCatalogo;
  readonly maxDias: number;
}

export type CodigoTrm =
  | "TRM_FORMATO" | "TRM_TRUNCADO" | "TRM_UNIDAD" | "TRM_VIGENCIA" | "TRM_SOLAPE" | "TRM_RANGO_INVALIDO" | "TRM_RED" | "TRM_TIPO";

export type ResultadoTrm =
  | { readonly ok: true; readonly valores: readonly ValorSerie[]; readonly descartadas: number }
  /** `codigo`: uno de CodigoTrm o `TRM_HTTP_<estado>`. */
  | { readonly ok: false; readonly codigo: string };

/** La TRM del catálogo, si es un TRAMO y su fuente es la de este lector; si no, null (no se adivina). */
export function trmDelCatalogo(catalogo: readonly SerieCatalogo[] = CATALOGO): SerieTrm | null {
  const serie = catalogo.find((s) => s.codigo === CODIGO_TRM);
  if (!serie || serie.vigencia.tipo !== "TRAMO" || serie.fuente !== FUENTE_TRM) return null;
  return { serie, maxDias: serie.vigencia.maxDias };
}

/** La consulta Socrata: las vigencias que TOCAN el rango (pueden empezar antes de `desde`), ordenadas y con límite. */
export function urlConsultaTrm(consulta: ConsultaTrm): string {
  const parametros = new URLSearchParams();
  parametros.set("$select", CAMPOS.join(","));
  parametros.set("$where", `vigenciahasta >= '${diaIso(consulta.desde)}T00:00:00' AND vigenciadesde <= '${diaIso(consulta.hasta)}T00:00:00'`);
  parametros.set("$order", "vigenciadesde ASC");
  parametros.set("$limit", String(LIMITE_FILAS_TRM));
  return `${URL_TRM}?${parametros.toString()}`;
}

/** Una fila ya sabida bien formada: su vigencia y lo que trae, sin validar aún la unidad ni el valor. */
interface FilaLeida {
  readonly desde: Date;
  readonly hasta: Date;
  readonly valor: string | undefined;
  readonly unidad: unknown;
}

type Paso<T> = { readonly ok: true; readonly valor: T } | { readonly ok: false; readonly codigo: CodigoTrm };
const falla = (codigo: CodigoTrm): Paso<never> => ({ ok: false, codigo });

/** «2027-03-10T00:00:00.000» (timestamp flotante de Socrata) → fecha de negocio. Nunca pasa por la zona del proceso. */
function leerFechaFlotante(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const m = TIMESTAMP_FLOTANTE.exec(valor);
  if (!m) return null;
  const fecha = leerFechaIso(m[1]!);
  return fecha.ok ? fecha.valor : null;
}

const CLAVES: ReadonlySet<string> = new Set(CAMPOS);

/** La fila con su vigencia, o null si su forma es rara (no objeto, claves de más, fechas o valor mal tipados, fuera del rango). */
function leerFila(f: unknown, consulta: ConsultaTrm): FilaLeida | null {
  if (typeof f !== "object" || f === null || Array.isArray(f)) return null;
  const fila = f as Readonly<Record<string, unknown>>;
  if (!Object.keys(fila).every((k) => CLAVES.has(k))) return null;
  const desde = leerFechaFlotante(fila.vigenciadesde);
  const hasta = leerFechaFlotante(fila.vigenciahasta);
  if (desde === null || hasta === null) return null;
  if (fila.valor !== undefined && typeof fila.valor !== "string") return null;
  if (hasta < consulta.desde || desde > consulta.hasta) return null;
  return { desde, hasta, valor: fila.valor, unidad: fila.unidad };
}

function leerEstructura(cuerpo: unknown, consulta: ConsultaTrm): Paso<readonly FilaLeida[]> {
  if (!Array.isArray(cuerpo)) return falla("TRM_FORMATO");
  if (cuerpo.length >= LIMITE_FILAS_TRM) return falla("TRM_TRUNCADO");
  const filas: FilaLeida[] = [];
  for (const f of cuerpo) {
    const fila = leerFila(f, consulta);
    if (fila === null) return falla("TRM_FORMATO");
    filas.push(fila);
  }
  return { ok: true, valor: filas };
}

const diasDe = (f: FilaLeida): number => (f.hasta.getTime() - f.desde.getTime()) / DIA_MS + 1;

/** El valor canónico (sin ceros sobrantes) si es un decimal de la escala y el rango de la serie; si no, null. */
function leerValor(valor: string | undefined, serie: SerieCatalogo): string | null {
  if (valor === undefined || !DECIMAL_FUENTE.test(valor)) return null;
  const canonico = canonizarValor(valor);
  if (canonico === null || (canonico.split(".")[1] ?? "").length > serie.escala) return null;
  const dentro = compararDecimales(canonico, serie.rango.min) >= 0 && compararDecimales(canonico, serie.rango.max) <= 0;
  return dentro ? canonico : null;
}

/** Para fundir filas idénticas: el valor canónico si lo es, o el texto tal cual (dos inválidos distintos no se funden). */
const claveValor = (valor: string | undefined): string => (valor === undefined ? "" : (canonizarValor(valor) ?? `!${valor}`));

const mismaFila = (a: FilaLeida, b: FilaLeida): boolean =>
  a.desde.getTime() === b.desde.getTime() && a.hasta.getTime() === b.hasta.getTime() && claveValor(a.valor) === claveValor(b.valor);

const porDesde = (a: FilaLeida, b: FilaLeida): number => a.desde.getTime() - b.desde.getTime() || a.hasta.getTime() - b.hasta.getTime();

/** Ordenadas por desde (no se confía en el $order), con las idénticas fundidas; TRM_SOLAPE si dos se cruzan. */
function sinSolapes(filas: readonly FilaLeida[]): Paso<readonly FilaLeida[]> {
  const unicas: FilaLeida[] = [];
  for (const actual of [...filas].sort(porDesde)) {
    const previa = unicas.at(-1);
    if (previa && mismaFila(previa, actual)) continue;
    if (previa && actual.desde <= previa.hasta) return falla("TRM_SOLAPE");
    unicas.push(actual);
  }
  return { ok: true, valor: unicas };
}

/**
 * Puro: convierte la respuesta de Socrata en vigencias de la TRM. Orden: estructura → unidad → forma de la vigencia →
 * solapes → valores (los inválidos se descartan y se cuentan).
 */
export function parsearTrm(cuerpo: unknown, consulta: ConsultaTrm, trm: SerieTrm): ResultadoTrm {
  const estructura = leerEstructura(cuerpo, consulta);
  if (!estructura.ok) return estructura;
  if (!estructura.valor.every((f) => f.unidad === UNIDAD)) return { ok: false, codigo: "TRM_UNIDAD" };
  if (!estructura.valor.every((f) => diasDe(f) >= 1 && diasDe(f) <= trm.maxDias)) return { ok: false, codigo: "TRM_VIGENCIA" };
  const unicas = sinSolapes(estructura.valor);
  if (!unicas.ok) return unicas;
  const valores: ValorSerie[] = [];
  for (const f of unicas.valor) {
    const valor = leerValor(f.valor, trm.serie);
    if (valor !== null) valores.push({ desde: f.desde, hasta: f.hasta, valor });
  }
  return { ok: true, valores, descartadas: unicas.valor.length - valores.length };
}

/** El JSON del cuerpo (UTF-8 estricto); ok: false si no es UTF-8 válido o no es JSON. */
function json(bytes: Uint8Array): { readonly ok: true; readonly datos: unknown } | { readonly ok: false } {
  try {
    return { ok: true, datos: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown };
  } catch {
    return { ok: false };
  }
}

/**
 * Pide a la SFC las vigencias de la TRM que tocan el rango. Sin redirecciones, con plazo total, tope de bytes y solo
 * `application/json` (UTF-8): los fallos vuelven como TRM_RED, TRM_HTTP_<estado>, TRM_TIPO o TRM_FORMATO. No lanza.
 */
export async function obtenerTrm(consulta: ConsultaTrm, buscar: BuscarHttp, trm: SerieTrm): Promise<ResultadoTrm> {
  if (consulta.desde > consulta.hasta) return { ok: false, codigo: "TRM_RANGO_INVALIDO" };
  const r = await pedirBytesAcotado(buscar, urlConsultaTrm(consulta), {
    prefijo: "TRM", headers: { Accept: "application/json" }, bytesMaximos: BYTES_MAXIMOS_TRM, tiempoMaximoMs: TIEMPO_MAXIMO_TRM_MS, tiposAceptados: TIPOS_ACEPTADOS,
  });
  if (!r.ok) return r;
  const leido = json(r.bytes);
  return leido.ok ? parsearTrm(leido.datos, consulta, trm) : { ok: false, codigo: "TRM_FORMATO" };
}
