/**
 * Métricas de la evaluación (E7), puras, por modelo (plan de la fase E, §6):
 * - publicación: publicadas sobre corridas (las CORTADAS por el operador no cuentan en nada), por tipo;
 * - rechazos por código del validador y fallos por motivo/detalle de la puerta;
 * - latencia del cliente: p50 y p95 por rango más cercano, con los tiempos agotados como +∞ («más que el límite»);
 *   la duración que midió el arnés aparte; la primera corrida (carga en frío) aparte;
 * - tokens; repetición entre la pasada 1 y la 2 del mismo caso; cobertura de hechos (citados sobre los del paquete);
 * - el auditor independiente sobre lo publicado; el indicio de recorte del contexto;
 * - la incertidumbre: intervalo de Wilson al 95 % de la publicación (con temperatura 0, las dos pasadas son casi el mismo
 *   dato: el n efectivo es el de los casos); la latencia de la pasada 1 aparte; la saturación del contexto;
 * - el criterio: evaluación completa, cero recomendaciones marcadas, al menos 90 % publicado y p95 de hasta 120 s; la
 *   claridad (al menos 4) la califica Jelk con los pares: queda PENDIENTE. «Cero marcadas» no prueba «cero
 *   recomendaciones»: lo publicado del modelo elegido se revisa a mano.
 */
import { TIPOS_RESUMEN, type TipoResumen } from "../contrato";
import { CODIGOS_VALIDADOR } from "../validador/codigos";
import { marcasDeRecomendacion } from "./auditoria";
import type { RegistroCorrida, RegistroPlantilla } from "./tipos";

export const CRITERIO = Object.freeze({ minTasaPublicacion: 0.9, maxP95Ms: 120_000, maxRecomendaciones: 0 });

/**
 * Indicio (no prueba) de que Ollama recortó el contexto: más caracteres por token de entrada que este umbral. El
 * español y el JSON rondan de 3 a 4 caracteres por token; un pedido recortado cuenta menos tokens. La caché de prompt
 * de Ollama también baja `prompt_eval_count`: por verificar en el Mac con el contexto real del modelo.
 */
export const CARACTERES_POR_TOKEN_SOSPECHOSO = 6;
/** z de un intervalo de Wilson al 95 %. */
const Z_95 = 1.96;

/** Lo que sabe quien llama de la evaluación: cuántas corridas tocaban y si terminó (sin corte). */
export interface Completitud {
  readonly esperadas: number;
  readonly completa: boolean;
}

export interface MetricasLatencia {
  readonly n: number;
  readonly p50: number | null;
  readonly p95: number | null;
  readonly max: number | null;
  readonly agotadas: number;
  /** El p95 cae en un tiempo agotado: «más que el límite». */
  readonly p95SobreElLimite: boolean;
}

export interface MetricasModelo {
  readonly modelo: string;
  readonly corridas: number;
  readonly cortadas: number;
  readonly publicadas: number;
  readonly rechazadas: number;
  readonly fallidas: number;
  readonly tasaPublicacion: number | null;
  /** Intervalo de Wilson al 95 % de la tasa; «no concluyente» si cruza el umbral (o no hay corridas). */
  readonly publicacion: { readonly intervalo95: readonly [number, number] | null; readonly noConcluyente: boolean };
  readonly porTipo: Readonly<Record<TipoResumen, { readonly corridas: number; readonly publicadas: number }>>;
  readonly rechazosPorCodigo: Readonly<Record<string, number>>;
  readonly fallosPorMotivo: Readonly<Record<string, number>>;
  readonly latencia: MetricasLatencia;
  /** Solo la pasada 1: la 2 puede salir más rápida por la caché de prompt de Ollama. */
  readonly latenciaPasada1: MetricasLatencia;
  readonly duracion: { readonly p50: number | null; readonly p95: number | null };
  readonly primeraCorridaMs: number | null;
  readonly tokens: { readonly entradaMax: number | null; readonly entradaMedia: number | null; readonly salidaMax: number | null; readonly salidaMedia: number | null };
  readonly repeticion: { readonly casos: number; readonly mismoEstado: number; readonly mismaSalida: number; readonly mismoTexto: number };
  readonly cobertura: number | null;
  readonly recomendaciones: { readonly marcadas: number; readonly corridas: readonly string[] };
  readonly posibleRecorte: number;
  /** Corridas con el máximo de tokens de entrada compartido por pedidos de largo distinto (contexto saturado). */
  readonly entradaEnElTope: number;
  /** Lo que se vio en las corridas: para comparar modelos, tiene que ser lo mismo. */
  readonly versiones: { readonly prompts: readonly string[]; readonly validador: readonly string[]; readonly digest: readonly string[] };
  readonly criterio: { readonly completa: boolean; readonly recomendaciones: boolean; readonly publicacion: boolean; readonly latencia: boolean; readonly claridad: "PENDIENTE"; readonly apto: boolean };
}

/** Percentil por rango más cercano: el valor en la posición ⌈q·n⌉ de la lista ordenada; null si está vacía. */
export function percentil(valores: readonly number[], q: number): number | null {
  if (!(q > 0 && q <= 1)) throw new RangeError("El percentil va de 0 (sin incluir) a 1.");
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.ceil(q * orden.length) - 1] as number;
}

const finitoONulo = (v: number | null): number | null => (v === null || Number.isFinite(v) ? v : null);
const media = (valores: readonly number[]): number | null => (valores.length === 0 ? null : valores.reduce((s, v) => s + v, 0) / valores.length);
const maximo = (valores: readonly number[]): number | null => (valores.length === 0 ? null : Math.max(...valores));

function contar(claves: readonly string[], orden?: readonly string[]): Readonly<Record<string, number>> {
  const cuenta = new Map<string, number>();
  for (const c of claves) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  const llaves = orden === undefined ? [...cuenta.keys()] : orden.filter((c) => cuenta.has(c));
  return Object.freeze(Object.fromEntries(llaves.map((c) => [c, cuenta.get(c) as number])));
}

function latencia(r: readonly RegistroCorrida[]): MetricasLatencia {
  const muestra = r.flatMap((x) => (x.latenciaMs !== null ? [x.latenciaMs] : x.agotado ? [Number.POSITIVE_INFINITY] : []));
  const p95 = percentil(muestra, 0.95);
  return Object.freeze({
    n: muestra.length, p50: finitoONulo(percentil(muestra, 0.5)), p95: finitoONulo(p95), max: maximo(muestra.filter(Number.isFinite)),
    agotadas: r.filter((x) => x.agotado).length, p95SobreElLimite: p95 === Number.POSITIVE_INFINITY,
  });
}

/** Intervalo de Wilson al 95 % de k éxitos en n. */
function wilson(k: number, n: number): readonly [number, number] {
  const p = k / n;
  const z2 = Z_95 * Z_95;
  const centro = (p + z2 / (2 * n)) / (1 + z2 / n);
  const margen = (Z_95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return Object.freeze([Math.max(0, centro - margen), Math.min(1, centro + margen)] as const);
}

function publicacion(k: number, n: number): MetricasModelo["publicacion"] {
  if (n === 0) return Object.freeze({ intervalo95: null, noConcluyente: true });
  const intervalo95 = wilson(k, n);
  return Object.freeze({ intervalo95, noConcluyente: intervalo95[0] < CRITERIO.minTasaPublicacion && intervalo95[1] >= CRITERIO.minTasaPublicacion });
}

function entradaEnElTope(r: readonly RegistroCorrida[]): number {
  const conTokens = r.filter((x) => x.tokensEntrada !== null);
  const tope = maximo(conTokens.map((x) => x.tokensEntrada as number));
  const enElTope = conTokens.filter((x) => x.tokensEntrada === tope);
  return new Set(enElTope.map((x) => x.caracteresPedido)).size > 1 ? enElTope.length : 0;
}

const distintos = (valores: readonly (string | null)[]): readonly string[] => Object.freeze([...new Set(valores.filter((v): v is string => v !== null))].sort());

function repeticion(r: readonly RegistroCorrida[]): MetricasModelo["repeticion"] {
  const pares = [...new Set(r.map((x) => x.caso))].flatMap((caso) => {
    const uno = r.find((x) => x.caso === caso && x.pasada === 1);
    const dos = r.find((x) => x.caso === caso && x.pasada === 2);
    return uno !== undefined && dos !== undefined ? [[uno, dos] as const] : [];
  });
  return Object.freeze({
    casos: pares.length,
    mismoEstado: pares.filter(([a, b]) => a.estado === b.estado).length,
    mismaSalida: pares.filter(([a, b]) => a.salidaHash !== null && a.salidaHash === b.salidaHash).length,
    mismoTexto: pares.filter(([a, b]) => a.texto !== null && a.texto === b.texto).length,
  });
}

function porTipo(r: readonly RegistroCorrida[]): MetricasModelo["porTipo"] {
  const de = (tipo: TipoResumen) => ({ corridas: r.filter((x) => x.tipo === tipo).length, publicadas: r.filter((x) => x.tipo === tipo && x.estado === "PUBLICADO").length });
  return Object.freeze(Object.fromEntries(TIPOS_RESUMEN.map((t) => [t, de(t)])) as Record<TipoResumen, { corridas: number; publicadas: number }>);
}

/** Sin `completitud`, la evaluación no cuenta como completa: no hay apto. */
export function calcularMetricas(modelo: string, registros: readonly RegistroCorrida[], completitud: Completitud | null = null): MetricasModelo {
  const r = registros.filter((x) => x.estado !== "CORTADO");
  const publicadas = r.filter((x) => x.estado === "PUBLICADO");
  const tasa = r.length === 0 ? null : publicadas.length / r.length;
  const lat = latencia(r);
  const marcadas = publicadas.filter((x) => x.texto !== null && marcasDeRecomendacion(x.texto).length > 0);
  const entradas = r.flatMap((x) => (x.tokensEntrada === null ? [] : [x.tokensEntrada]));
  const salidas = r.flatMap((x) => (x.tokensSalida === null ? [] : [x.tokensSalida]));
  const duraciones = r.map((x) => x.duracionMs);
  const criterio = {
    completa: completitud !== null && completitud.completa && registros.length >= completitud.esperadas,
    recomendaciones: marcadas.length <= CRITERIO.maxRecomendaciones,
    publicacion: tasa !== null && tasa >= CRITERIO.minTasaPublicacion,
    latencia: lat.p95 !== null && !lat.p95SobreElLimite && lat.p95 <= CRITERIO.maxP95Ms,
  };
  return Object.freeze({
    modelo, corridas: r.length, cortadas: registros.length - r.length, publicadas: publicadas.length,
    rechazadas: r.filter((x) => x.estado === "RECHAZADO").length, fallidas: r.filter((x) => x.estado === "FALLIDO").length, tasaPublicacion: tasa,
    publicacion: publicacion(publicadas.length, r.length),
    porTipo: porTipo(r),
    rechazosPorCodigo: contar(r.filter((x) => x.estado === "RECHAZADO").flatMap((x) => x.motivos), CODIGOS_VALIDADOR),
    fallosPorMotivo: contar(r.filter((x) => x.estado === "FALLIDO").map((x) => `${x.motivos[0] ?? "SIN_MOTIVO"}/${x.detalle ?? "SIN_DETALLE"}`)),
    latencia: lat,
    latenciaPasada1: latencia(r.filter((x) => x.pasada === 1)),
    duracion: Object.freeze({ p50: percentil(duraciones, 0.5), p95: percentil(duraciones, 0.95) }),
    primeraCorridaMs: r.find((x) => x.orden === 1)?.latenciaMs ?? null,
    tokens: Object.freeze({ entradaMax: maximo(entradas), entradaMedia: media(entradas), salidaMax: maximo(salidas), salidaMedia: media(salidas) }),
    repeticion: repeticion(r),
    cobertura: media(publicadas.filter((x) => x.hechos > 0).map((x) => x.citados / x.hechos)),
    recomendaciones: Object.freeze({ marcadas: marcadas.length, corridas: Object.freeze(marcadas.map((x) => `${x.caso}#${x.pasada}`)) }),
    posibleRecorte: r.filter((x) => x.tokensEntrada !== null && x.tokensEntrada > 0 && x.caracteresPedido / x.tokensEntrada > CARACTERES_POR_TOKEN_SOSPECHOSO).length,
    entradaEnElTope: entradaEnElTope(r),
    versiones: Object.freeze({ prompts: distintos(r.map((x) => x.promptVersion)), validador: distintos(r.map((x) => x.validadorVersion)), digest: distintos(r.map((x) => x.modeloDigest)) }),
    criterio: Object.freeze({ ...criterio, claridad: "PENDIENTE" as const, apto: criterio.completa && criterio.recomendaciones && criterio.publicacion && criterio.latencia }),
  });
}

/** La línea base: cuántas plantillas sin IA publica el validador. */
export function lineaBase(plantillas: readonly RegistroPlantilla[]): { readonly casos: number; readonly publicadas: number; readonly tasa: number | null } {
  const publicadas = plantillas.filter((p) => p.estado === "PUBLICADO").length;
  return Object.freeze({ casos: plantillas.length, publicadas, tasa: plantillas.length === 0 ? null : publicadas / plantillas.length });
}
