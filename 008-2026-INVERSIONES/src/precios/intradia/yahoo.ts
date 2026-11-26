/**
 * Barras de 1 minuto de Yahoo Finance (`<NEMO>.CL`, COP) para los precios cada minuto durante la rueda. Es el mismo endpoint
 * no oficial de los cierres (`src/precios/yahoo.ts`), con `interval=1m&range=1d`, y las mismas condiciones: sin
 * seguir redirecciones, con plazo total y tope de bytes (`src/lib/http-acotado.ts`), y cualquier fallo vuelve como código
 * (nunca lanza). Se usa el precio SIN ajustar (`indicators.quote.close`).
 * - Yahoo entrega estas barras con retraso (se documenta en 20 min; en rueda, por verificar): `conRetraso` es lo que la
 *   respuesta marca (`meta.exchangeDataDelayedBy` mayor que 0), no una suposición.
 * - Solo entran las barras de HOY en Colombia, ya cerradas (con más de MARGEN_BARRA_ABIERTA_MS) y con negociación: antes de
 *   abrir, Yahoo devuelve la última rueda y no se guarda como de hoy; una barra con volumen 0 es «sin negociación».
 * - La primera barra que llega es la que queda (ON CONFLICT DO NOTHING): supone que una barra con más de un minuto ya no se revisa;
 *   por verificar con datos reales en rueda (con el retraso de ~20 min no pasa).
 * - Una respuesta rara (series de otro largo, un precio sobre el tope, volumen corrupto) se rechaza entera: YAHOO_FORMATO.
 */
import { pedirJsonAcotado } from "../../lib/http-acotado";
import { fechaEnBogota } from "../horario";
import { PRECIO_MAXIMO_COP, type Buscar } from "../yahoo";
import { urlBaseYahoo } from "./url";

const ESCALA_PRECIO = 6;
const TIEMPO_MAXIMO_MS = 10_000;
/** Una barra con menos de esto de antigüedad todavía se está formando: no se guarda. */
export const MARGEN_BARRA_ABIERTA_MS = 60_000;
/** Un día de rueda trae a lo sumo ~600 barras de 1 minuto; por encima, la respuesta se considera corrupta. */
export const BARRAS_MAXIMAS_INTRADIA = 2_000;
export const BYTES_MAXIMOS_INTRADIA = 1024 * 1024;

/** Símbolo de Yahoo: hasta 20 caracteres, sin empezar por «.» ni «-» (así «..» no puede tocar la ruta). */
const SIMBOLO_RE = /^[A-Z0-9^][A-Z0-9.^-]{0,19}$/;

export interface BarraIntradia {
  readonly instante: Date;
  /** Texto decimal canónico (hasta 6 decimales). */
  readonly precio: string;
}

export type ResultadoBarras = { readonly ok: true; readonly barras: BarraIntradia[]; readonly conRetraso: boolean } | { readonly ok: false; readonly codigo: string };

interface RespuestaChart {
  chart?: {
    result?: { meta?: { currency?: string; exchangeDataDelayedBy?: unknown }; timestamp?: unknown; indicators?: { quote?: { close?: unknown; volume?: unknown }[] } }[] | null;
  };
}

/** Precio con a lo sumo 6 decimales, sin notación científica; null si no es positivo, no es finito o pasa el tope. */
function canonico(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0 || n > PRECIO_MAXIMO_COP) return null;
  const t = n.toFixed(ESCALA_PRECIO).replace(/\.?0+$/, "");
  return t === "" || t === "0" ? null : t;
}

/** El día de Colombia de un instante en milisegundos (la medianoche UTC de su fecha, comparable entre sí): `fechaEnBogota` del horario. */
const diaCot = (ms: number): number => fechaEnBogota(new Date(ms)).getTime();

/** Volúmenes por barra (null donde no hay dato); null si la serie es corrupta (largo distinto o un valor no numérico o negativo). */
function leerVolumenes(volume: unknown, largo: number): (number | null)[] | null {
  if (volume === undefined || volume === null) return Array.from({ length: largo }, () => null);
  if (!Array.isArray(volume) || volume.length !== largo) return null;
  const valores = volume.map((v: unknown) => (v === null || v === undefined ? null : typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : Number.NaN));
  return valores.some((v) => Number.isNaN(v)) ? null : valores;
}

/** Puro: la respuesta de /v8/finance/chart con barras de 1 minuto → las barras de hoy ya cerradas, ordenadas, sin repetir. */
export function parsearBarrasIntradia(cuerpo: unknown, ahora: Date): ResultadoBarras {
  const r = (cuerpo as RespuestaChart | null)?.chart?.result?.[0];
  if (!r) return { ok: false, codigo: "YAHOO_SIN_DATOS" };
  if (r.meta?.currency !== "COP") return { ok: false, codigo: "YAHOO_MONEDA_NO_COP" };
  const ts = r.timestamp ?? [];
  const cierres = r.indicators?.quote?.[0]?.close ?? [];
  if (!Array.isArray(ts) || !Array.isArray(cierres) || ts.length !== cierres.length || ts.length > BARRAS_MAXIMAS_INTRADIA) return { ok: false, codigo: "YAHOO_FORMATO" };
  const volumenes = leerVolumenes(r.indicators?.quote?.[0]?.volume, ts.length);
  if (!volumenes) return { ok: false, codigo: "YAHOO_FORMATO" };
  const retraso = r.meta?.exchangeDataDelayedBy;
  const conRetraso = typeof retraso === "number" && Number.isFinite(retraso) && retraso > 0;
  const hoy = diaCot(ahora.getTime());
  const limite = ahora.getTime() - MARGEN_BARRA_ABIERTA_MS;
  const porInstante = new Map<number, BarraIntradia>();
  for (let i = 0; i < ts.length; i += 1) {
    const t: unknown = ts[i];
    const valor: unknown = cierres[i];
    if (typeof valor === "number" && Number.isFinite(valor) && valor > PRECIO_MAXIMO_COP) return { ok: false, codigo: "YAHOO_FORMATO" };
    // Las barras de 1 minuto caen en el minuto exacto: una hora con segundos sería la última negociación, no una barra.
    const ms = typeof t === "number" && Number.isInteger(t) && t % 60 === 0 ? t * 1000 : Number.NaN;
    const instante = new Date(ms);
    const precio = typeof valor === "number" ? canonico(valor) : null;
    if (Number.isNaN(instante.getTime()) || precio === null || volumenes[i] === 0) continue;
    if (ms > limite || diaCot(ms) !== hoy) continue;
    porInstante.set(ms, { instante, precio }); // la misma barra dos veces: gana la última con precio
  }
  return { ok: true, conRetraso, barras: [...porInstante.values()].sort((a, b) => a.instante.getTime() - b.instante.getTime()) };
}

export interface OpcionesBarras {
  /** La URL base de Yahoo (por configuración), p. ej. «https://host». */
  readonly baseUrl: string;
  readonly buscar: Buscar;
  readonly ahora: Date;
}

/** Pide las barras de 1 minuto de hoy de un símbolo. No lanza: los fallos vuelven como código. */
export async function obtenerBarrasIntradia(simbolo: string, opciones: OpcionesBarras): Promise<ResultadoBarras> {
  if (!SIMBOLO_RE.test(simbolo)) return { ok: false, codigo: "SIMBOLO_INVALIDO" };
  const base = urlBaseYahoo(opciones.baseUrl);
  if (base === null) return { ok: false, codigo: "INTRADIA_URL_INVALIDA" };
  const url = `${base}/v8/finance/chart/${encodeURIComponent(simbolo)}?interval=1m&range=1d`;
  const r = await pedirJsonAcotado(opciones.buscar, url, { prefijo: "YAHOO", headers: { "User-Agent": "Mozilla/5.0" }, bytesMaximos: BYTES_MAXIMOS_INTRADIA, tiempoMaximoMs: TIEMPO_MAXIMO_MS });
  return r.ok ? parsearBarrasIntradia(r.datos, opciones.ahora) : r;
}
