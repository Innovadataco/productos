/**
 * Bootstrap circular por bloques sobre la historia de retornos (método en metodo.ts). Puro y reproducible: la misma
 * historia, cartera, parámetros y semilla dan exactamente el mismo resultado.
 * Por trayectoria y por día sorteado t (el MISMO para todas las columnas):
 *   dividendo de la columna = valor × rendimiento(t);  valor ← valor × factor(t);  reinvertir ⇒ valor += dividendo.
 * Sin reinvertir, el dividendo sale del valor y se acumula aparte (cuenta en la probabilidad bajo lo aportado).
 * La parte fija (posiciones sin historia suficiente) no se mueve, pero recibe su parte de los aportes.
 * Los aportes entran al final de cada periodo, repartidos con los pesos de hoy. La caída máxima se mide sobre un
 * índice diario tipo TWR (sin los aportes, con los dividendos del día y con la caída inicial).
 * Un mes m termina en la rueda round(m · ruedasPorMes): el redondeo es acumulado y no deriva.
 */
import { percentil } from "./estadistica";
import { BLOQUE, TOLERANCIA_RELATIVA } from "./metodo";
import { crearPrng, type Prng } from "./prng";
import { MESES_FRECUENCIA, type Historia, type ParametrosProyeccion, type PuntoProyeccion } from "./tipos";

export interface Cartera {
  /** Valor de hoy de cada columna proyectada (K). */
  readonly valores: Float64Array;
  /** Valor de hoy de la parte fija. */
  readonly fijo: number;
}

export interface Simulacion {
  readonly puntos: readonly PuntoProyeccion[];
  readonly probabilidadBajoAportado: number;
  readonly caidaMaximaMediana: number;
}

export interface OpcionesSimulacion {
  /** Largo del bloque (solo para pruebas del método); por defecto, BLOQUE. */
  readonly bloque?: number;
}

/** Lo que no cambia entre trayectorias. */
interface Plan {
  readonly h: Historia;
  readonly bloque: number;
  readonly inicio: Float64Array;
  readonly fijo0: number;
  readonly pesos: Float64Array;
  readonly pesoFijo: number;
  readonly caida: number;
  readonly reinvertir: boolean;
  readonly aporte: number;
  readonly cadaMeses: number;
  readonly horizonte: number;
  /** Ruedas acumuladas al final de cada mes (índice = mes). */
  readonly ruedasHasta: Int32Array;
  /** 1 si algún rendimiento del día es distinto de 0. */
  readonly conDividendo: Uint8Array;
}

/** Estado de una trayectoria. */
interface Trayectoria {
  readonly valores: Float64Array;
  fijo: number;
  dividendos: number;
  indice: number;
  pico: number;
  caidaMaxima: number;
  posBloque: number;
  inicioBloque: number;
}

function validar(h: Historia, c: Cartera): void {
  if (c.valores.length !== h.K) throw new RangeError("La cartera debe traer un valor por columna de la historia.");
  if (h.K > 0 && h.T < 1) throw new RangeError("Una historia con columnas necesita al menos un retorno.");
  if (h.factores.length !== h.T * h.K || h.rendimientos.length !== h.T * h.K) throw new RangeError("Historia mal formada.");
}

function armarPlan(h: Historia, c: Cartera, p: ParametrosProyeccion, opciones: OpcionesSimulacion): Plan {
  const total = c.valores.reduce((s, v) => s + v, 0) + c.fijo;
  const pesos = total > 0 ? c.valores.map((v) => v / total) : new Float64Array(h.K);
  const ruedasHasta = Int32Array.from({ length: p.horizonteMeses + 1 }, (_, m) => (h.K > 0 ? Math.round(m * h.ruedasPorMes) : 0));
  const conDividendo = new Uint8Array(h.T);
  for (let t = 0; t < h.T; t += 1) {
    for (let k = 0; k < h.K; k += 1) if (h.rendimientos[t * h.K + k] !== 0) conDividendo[t] = 1;
  }
  return {
    h, bloque: Math.max(1, Math.min(opciones.bloque ?? BLOQUE, h.T || 1)), inicio: c.valores, fijo0: c.fijo, pesos,
    pesoFijo: total > 0 ? c.fijo / total : 1, caida: p.caidaInicialPct / 100, reinvertir: p.reinvertirDividendos,
    aporte: p.aportePeriodico, cadaMeses: MESES_FRECUENCIA[p.frecuenciaAporte], horizonte: p.horizonteMeses, ruedasHasta, conDividendo,
  };
}

function nuevaTrayectoria(pl: Plan): Trayectoria {
  const queda = 1 - pl.caida;
  return { valores: pl.inicio.map((v) => v * queda), fijo: pl.fijo0 * queda, dividendos: 0, indice: queda, pico: 1, caidaMaxima: pl.caida, posBloque: 0, inicioBloque: 0 };
}

/** Un día sorteado: mueve las columnas, cobra o reinvierte el dividendo y actualiza el índice y su caída. */
function avanzarDia(pl: Plan, tr: Trayectoria, azar: Prng): void {
  const { h } = pl;
  if (tr.posBloque === 0) tr.inicioBloque = azar.enteroMenorQue(h.T);
  let t = tr.inicioBloque + tr.posBloque;
  if (t >= h.T) t -= h.T;
  tr.posBloque = tr.posBloque + 1 === pl.bloque ? 0 : tr.posBloque + 1;
  const base = t * h.K;
  const v = tr.valores;
  let antes = tr.fijo;
  let despues = tr.fijo;
  let dividendo = 0;
  if (pl.conDividendo[t] === 1) {
    for (let k = 0; k < h.K; k += 1) {
      const x = v[k]!;
      const d = x * h.rendimientos[base + k]!;
      const nuevo = x * h.factores[base + k]! + (pl.reinvertir ? d : 0);
      antes += x;
      despues += nuevo;
      dividendo += d;
      v[k] = nuevo;
    }
  } else {
    for (let k = 0; k < h.K; k += 1) {
      const x = v[k]!;
      const nuevo = x * h.factores[base + k]!;
      antes += x;
      despues += nuevo;
      v[k] = nuevo;
    }
  }
  tr.dividendos += dividendo;
  if (antes > 0) {
    tr.indice *= (despues + (pl.reinvertir ? 0 : dividendo)) / antes;
    if (tr.indice > tr.pico) tr.pico = tr.indice;
    else if (1 - tr.indice / tr.pico > tr.caidaMaxima) tr.caidaMaxima = 1 - tr.indice / tr.pico;
  }
}

function aportar(pl: Plan, tr: Trayectoria): void {
  for (let k = 0; k < pl.h.K; k += 1) tr.valores[k] = tr.valores[k]! + pl.aporte * pl.pesos[k]!;
  tr.fijo += pl.aporte * pl.pesoFijo;
}

const valorDe = (tr: Trayectoria): number => tr.valores.reduce((s, v) => s + v, tr.fijo);

const aportadoEn = (pl: Plan, total0: number, m: number): number => total0 + pl.aporte * Math.floor(m / pl.cadaMeses);

export function simular(h: Historia, c: Cartera, p: ParametrosProyeccion, opciones: OpcionesSimulacion = {}): Simulacion {
  validar(h, c);
  const pl = armarPlan(h, c, p, opciones);
  const N = p.trayectorias;
  const H = p.horizonteMeses;
  const valores = new Float64Array(N * (H + 1));
  const dividendos = new Float64Array(N * (H + 1));
  const caidas = new Float64Array(N);
  const finales = new Float64Array(N);
  const azar = crearPrng(p.semilla);
  for (let i = 0; i < N; i += 1) {
    const tr = nuevaTrayectoria(pl);
    valores[i] = valorDe(tr);
    let dia = 0;
    for (let m = 1; m <= H; m += 1) {
      for (; dia < pl.ruedasHasta[m]!; dia += 1) avanzarDia(pl, tr, azar);
      if (pl.aporte > 0 && m % pl.cadaMeses === 0) aportar(pl, tr);
      valores[m * N + i] = valorDe(tr);
      dividendos[m * N + i] = tr.dividendos;
    }
    caidas[i] = tr.caidaMaxima;
    finales[i] = valores[H * N + i]! + (pl.reinvertir ? 0 : tr.dividendos);
  }
  return resumir(pl, c, valores, dividendos, caidas, finales, N);
}

function resumir(pl: Plan, c: Cartera, valores: Float64Array, dividendos: Float64Array, caidas: Float64Array, finales: Float64Array, N: number): Simulacion {
  const total0 = c.valores.reduce((s, v) => s + v, 0) + c.fijo;
  const puntos = Array.from({ length: pl.horizonte + 1 }, (_, m): PuntoProyeccion => {
    const fila = valores.subarray(m * N, (m + 1) * N).sort();
    const divs = dividendos.subarray(m * N, (m + 1) * N).sort();
    return {
      mes: m, p5: percentil(fila, 0.05), p25: percentil(fila, 0.25), p50: percentil(fila, 0.5), p75: percentil(fila, 0.75), p95: percentil(fila, 0.95),
      aportado: aportadoEn(pl, total0, m), dividendosP50: percentil(divs, 0.5),
    };
  });
  const aportadoFinal = aportadoEn(pl, total0, pl.horizonte);
  const umbral = aportadoFinal - TOLERANCIA_RELATIVA * Math.abs(aportadoFinal);
  const debajo = finales.reduce((n, f) => n + (f < umbral ? 1 : 0), 0);
  return { puntos, probabilidadBajoAportado: debajo / N, caidaMaximaMediana: percentil(caidas.sort(), 0.5) };
}
