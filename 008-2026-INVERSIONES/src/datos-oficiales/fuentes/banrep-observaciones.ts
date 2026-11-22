/**
 * Las observaciones de UNA serie del SDMX de BanRep, ya sacadas del XML (banrep-sdmx.ts): de texto a vigencias de un
 * día, puro y sin XML. Valores SIEMPRE como texto decimal canónico (canonizarValor del CSV de series): nunca Number ni
 * redondeo.
 * - Falla cerrada (sin entregar nada): una fecha que no es AAAAMMDD válida (BANREP_OBS_INVALIDA) o el mismo día dos
 *   veces con valor o estado distintos (BANREP_AMBIGUO). Los duplicados se buscan sobre TODAS las observaciones, antes de
 *   descartar: un gemelo descartado no tapa la ambigüedad. Iguales (mismo valor canónico y estado) se funden.
 * - Fuera de [desde, hasta]: se cuenta aparte (informativo; la descarga va por años).
 * - Se descarta y se cuenta por razón (el CSV sale con lo demás): sin ObsValue (observación faltante), OBS_STATUS
 *   ausente o distinto de A (no definitiva) y un valor que no es decimal o que no cabe en la escala o el rango de cordura
 *   del catálogo (el catálogo dice POR VERIFICAR: un valor que no cabe se reporta, nunca se ajusta).
 */
import type { SerieCatalogo } from "../catalogo";
import { canonizarValor, compararDecimales, type ValorSerie } from "../series/csv-series";
import { leerFechaIso } from "../../importacion/trii/valores";
import { falloBanrep, type FalloBanrep } from "./banrep-series";

/** El estado de una observación normal (lista de códigos OBS_STATUS de SDMX). Observado en todas las descargas públicas. */
export const ESTADO_DEFINITIVO = "A";
/** AAAAMMDD, como lo publica BanRep (observado el 2026-11-21), en los siglos que acepta el CSV de series. */
const FECHA_SDMX = /^((?:19|20)[0-9]{2})([0-9]{2})([0-9]{2})$/;

/** Una observación tal como viene: el texto de ObsDimension, el de ObsValue (null si no viene) y su OBS_STATUS. */
export interface ObsCruda {
  readonly dia: string;
  readonly valor: string | null;
  readonly estado: string | null;
}

export interface ConteosBanrep {
  /** Observaciones de la serie en el XML, con los duplicados. */
  readonly observaciones: number;
  readonly fueraDelRango: number;
  readonly noDefinitivas: number;
  readonly sinValor: number;
  readonly valorInvalido: number;
}

export interface LecturaBanrep {
  readonly ok: true;
  /** Ordenadas por fecha; una por día (desde = hasta). */
  readonly valores: readonly ValorSerie[];
  readonly conteos: ConteosBanrep;
}

export type ResultadoBanrep = LecturaBanrep | FalloBanrep;

/** «AAAAMMDD» → fecha de negocio (medianoche UTC), o null si no es una fecha que existe. */
export function leerFechaSdmx(texto: string): Date | null {
  const m = FECHA_SDMX.exec(texto);
  if (!m) return null;
  const r = leerFechaIso(`${m[1]}-${m[2]}-${m[3]}`);
  return r.ok ? r.valor : null;
}

/** El valor canónico si es un decimal que cabe en la escala y el rango de la serie; null si no. */
export function valorDeLaSerie(texto: string, serie: SerieCatalogo): string | null {
  const canonico = canonizarValor(texto);
  if (canonico === null) return null;
  if ((canonico.split(".")[1] ?? "").length > serie.escala) return null;
  const dentro = compararDecimales(canonico, serie.rango.min) >= 0 && compararDecimales(canonico, serie.rango.max) <= 0;
  return dentro ? canonico : null;
}

interface Unica {
  readonly fecha: Date;
  readonly obs: ObsCruda;
  /** Lo que se compara entre gemelos: el valor canónico (o el texto tal cual) y el estado. */
  readonly huella: string;
}

const huellaDe = (o: ObsCruda): string => `${o.valor === null ? "\u0000" : (canonizarValor(o.valor) ?? `~${o.valor}`)}\u0001${o.estado ?? "\u0000"}`;

/** Una por día, ordenadas; el fallo si una fecha no sirve o dos gemelos difieren. */
function unicas(crudas: readonly ObsCruda[]): { readonly ok: true; readonly lista: readonly Unica[] } | FalloBanrep {
  const porDia = new Map<number, Unica>();
  for (const obs of crudas) {
    const fecha = leerFechaSdmx(obs.dia);
    if (fecha === null) return falloBanrep("BANREP_OBS_INVALIDA");
    const huella = huellaDe(obs);
    const previa = porDia.get(fecha.getTime());
    if (previa && previa.huella !== huella) return falloBanrep("BANREP_AMBIGUO");
    if (!previa) porDia.set(fecha.getTime(), { fecha, obs, huella });
  }
  return { ok: true, lista: [...porDia.values()].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()) };
}

type Razon = "fueraDelRango" | "sinValor" | "noDefinitivas" | "valorInvalido";
type Clase = { readonly entra: true; readonly valor: string } | { readonly entra: false; readonly razon: Razon };

/** El valor que entra, o la razón por la que no (en este orden: rango pedido, sin valor, estado, valor). */
function clasificar(u: Unica, serie: SerieCatalogo, desde: Date, hasta: Date): Clase {
  if (u.fecha.getTime() < desde.getTime() || u.fecha.getTime() > hasta.getTime()) return { entra: false, razon: "fueraDelRango" };
  if (u.obs.valor === null) return { entra: false, razon: "sinValor" };
  if (u.obs.estado !== ESTADO_DEFINITIVO) return { entra: false, razon: "noDefinitivas" };
  const valor = valorDeLaSerie(u.obs.valor, serie);
  return valor === null ? { entra: false, razon: "valorInvalido" } : { entra: true, valor };
}

/** Las vigencias de la serie en [desde, hasta] (los dos incluidos) y los conteos. Nunca lanza. */
export function leerObservaciones(crudas: readonly ObsCruda[], serie: SerieCatalogo, desde: Date, hasta: Date): ResultadoBanrep {
  const r = unicas(crudas);
  if (!r.ok) return r;
  const conteos: Record<Razon, number> = { fueraDelRango: 0, noDefinitivas: 0, sinValor: 0, valorInvalido: 0 };
  const valores: ValorSerie[] = [];
  for (const u of r.lista) {
    const c = clasificar(u, serie, desde, hasta);
    if (c.entra) valores.push(Object.freeze({ desde: u.fecha, hasta: u.fecha, valor: c.valor }));
    else conteos[c.razon] += 1;
  }
  return Object.freeze({ ok: true, valores: Object.freeze(valores), conteos: Object.freeze({ observaciones: crudas.length, ...conteos }) });
}
