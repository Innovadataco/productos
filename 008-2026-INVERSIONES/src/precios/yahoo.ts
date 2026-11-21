/**
 * Cierres diarios de Yahoo Finance (`<NEMO>.CL`, COP) — INV-SPEC-13.
 * Endpoint no oficial (INVESTIGACION-FUENTES-DATOS de 008): uso personal y moderado; si cambia o
 * falla, el dato no se guarda y el resultado lo informa. Se usa el cierre SIN ajustar
 * (`indicators.quote.close`): el ajustado no cuadra con el precio de valoración de A&V.
 * El pedido no sigue redirecciones y tiene plazo total y tope de bytes (`src/lib/http-acotado.ts`).
 */
import { pedirJsonAcotado, type BuscarHttp } from "../lib/http-acotado";

const DESFASE_COT_MS = 5 * 60 * 60 * 1000;
const ESCALA_PRECIO = 6;
const TIEMPO_MAXIMO_MS = 10_000;
/** Tope de cordura de un precio en COP: por encima, la respuesta se considera corrupta. */
export const PRECIO_MAXIMO_COP = 10_000_000;
/** Tope de barras por respuesta (~40 años de ruedas): por encima, la respuesta se considera corrupta. */
export const BARRAS_MAXIMAS = 10_000;
/** Tope del cuerpo de la respuesta: 10 000 barras con sus seis series caben en ~1,3 MB (estimado por verificar). */
export const BYTES_MAXIMOS_YAHOO = 2 * 1024 * 1024;

export interface Cierre {
  readonly fecha: Date; // fecha de negocio en Colombia, a medianoche UTC
  readonly precio: string; // texto decimal canónico (hasta 6 decimales)
  /** Volumen negociado de la barra: 0 es «sin negociación»; null si Yahoo no lo trae. */
  readonly volumen: number | null;
}

export type ResultadoYahoo = { ok: true; cierres: Cierre[] } | { ok: false; codigo: string };

/** Símbolo de Yahoo: hasta 20 caracteres, sin empezar por «.» ni «-» (así «..» no puede tocar la ruta). */
const SIMBOLO_RE = /^[A-Z0-9^][A-Z0-9.^-]{0,19}$/;

/** `fetch` inyectable: en las pruebas nunca hay red real. Se pide sin seguir redirecciones. */
export type Buscar = BuscarHttp;

/** Precio con a lo sumo 6 decimales, sin notación científica ni punto flotante residual. */
function canonico(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0 || n > PRECIO_MAXIMO_COP) return null;
  const t = n.toFixed(ESCALA_PRECIO).replace(/\.?0+$/, "");
  return t === "" || t === "0" ? null : t;
}

/** Fecha de negocio en Colombia (UTC−5) de un instante en segundos Unix; null si cae fuera del rango de fechas. */
function fechaCot(segundos: number): Date | null {
  const local = new Date(segundos * 1000 - DESFASE_COT_MS);
  if (Number.isNaN(local.getTime())) return null;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

interface RespuestaChart {
  chart?: { result?: { meta?: { currency?: string }; timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[]; volume?: unknown }[] } }[] | null; error?: unknown };
}

/**
 * Volúmenes de la serie, uno por barra. Sin serie (ausente o null), todos null. Una serie que no es
 * arreglo, de otro largo, o con un valor no nulo que no sea un número finito ≥ 0, es corrupta (null):
 * no se adivina si hubo negociación.
 */
function leerVolumenes(volume: unknown, largo: number): (number | null)[] | null {
  if (volume === undefined || volume === null) return Array.from({ length: largo }, () => null);
  if (!Array.isArray(volume) || volume.length !== largo) return null;
  const valores = volume.map((v: unknown) => (v === null || v === undefined ? null : typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : Number.NaN));
  return valores.some((v) => Number.isNaN(v)) ? null : valores;
}

/**
 * Puro: convierte la respuesta de /v8/finance/chart en cierres con su volumen. Exige COP y descarta
 * huecos (null) y barras con timestamp inválido. Series que no son arreglos, de largos distintos o de
 * más de BARRAS_MAXIMAS, un volumen corrupto o un precio sobre el tope invalidan toda la respuesta
 * (YAHOO_FORMATO). Si el volumen es 0 o el día no es hábil, lo decide quien guarda (`negociacion.ts`).
 */
export function parsearYahoo(cuerpo: unknown): ResultadoYahoo {
  const r = (cuerpo as RespuestaChart)?.chart?.result?.[0];
  if (!r) return { ok: false, codigo: "YAHOO_SIN_DATOS" };
  if (r.meta?.currency !== "COP") return { ok: false, codigo: "YAHOO_MONEDA_NO_COP" };
  const ts = r.timestamp ?? [];
  const cierres = r.indicators?.quote?.[0]?.close ?? [];
  if (!Array.isArray(ts) || !Array.isArray(cierres)) return { ok: false, codigo: "YAHOO_FORMATO" };
  if (ts.length !== cierres.length || ts.length > BARRAS_MAXIMAS) return { ok: false, codigo: "YAHOO_FORMATO" };
  const volumenes = leerVolumenes(r.indicators?.quote?.[0]?.volume, ts.length);
  if (!volumenes) return { ok: false, codigo: "YAHOO_FORMATO" };
  const porFecha = new Map<number, Cierre>();
  let corrupta = false;
  ts.forEach((t, i) => {
    const valor = cierres[i];
    if (typeof valor === "number" && Number.isFinite(valor) && valor > PRECIO_MAXIMO_COP) corrupta = true;
    const precio = typeof valor === "number" ? canonico(valor) : null;
    const fecha = Number.isFinite(t) ? fechaCot(t) : null;
    if (precio && fecha) porFecha.set(fecha.getTime(), { fecha, precio, volumen: volumenes[i] ?? null }); // dos barras el mismo día: gana la última con precio, con su volumen
  });
  if (corrupta) return { ok: false, codigo: "YAHOO_FORMATO" };
  return { ok: true, cierres: [...porFecha.values()].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()) };
}

/** Pide los cierres diarios entre dos fechas (incluidas). No lanza: los fallos vuelven como código. */
export async function obtenerCierres(simbolo: string, desde: Date, hasta: Date, buscar: Buscar): Promise<ResultadoYahoo> {
  if (!SIMBOLO_RE.test(simbolo)) return { ok: false, codigo: "SIMBOLO_INVALIDO" };
  const p1 = Math.floor(desde.getTime() / 1000);
  const p2 = Math.floor(hasta.getTime() / 1000) + 24 * 60 * 60;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?interval=1d&period1=${p1}&period2=${p2}`;
  const r = await pedirJsonAcotado(buscar, url, { prefijo: "YAHOO", headers: { "User-Agent": "Mozilla/5.0" }, bytesMaximos: BYTES_MAXIMOS_YAHOO, tiempoMaximoMs: TIEMPO_MAXIMO_MS });
  return r.ok ? parsearYahoo(r.datos) : r;
}
