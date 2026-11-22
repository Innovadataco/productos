// Generadores de entradas INVENTADAS para el motor de proyecciones. Nada sale de una base: series sintéticas en
// código, con fechas anteriores a 2022 y números raros. Los festivos de 2019-2021 que se usan aquí son inventados
// (solo sirven para que el año cuente como sembrado y para probar que el día se descarta).
import type { AccionEntrada, Cierre, EntradasProyeccion, FondoEntrada, Historia } from "@/proyecciones/tipos";

const DIA_MS = 86_400_000;

export const dia = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
export const iso = (d: Date): string => d.toISOString().slice(0, 10);
export const sumar = (d: Date, n: number): Date => new Date(d.getTime() + n * DIA_MS);

/** Festivos inventados (uno por año de 2015 a 2021, para que esos años cuenten como sembrados). */
export const FESTIVOS_FICTICIOS: readonly Date[] = ["2015-06-17", "2016-06-15", "2017-06-14", "2018-06-13", "2019-06-12", "2020-06-17", "2021-06-16"].map(dia);

/** Días hábiles (lunes a viernes, sin los festivos dados) desde `desde`, `n` en total. */
export function diasHabiles(desde: string, n: number, festivos: readonly Date[] = FESTIVOS_FICTICIOS): Date[] {
  const fuera = new Set(festivos.map(iso));
  const dias: Date[] = [];
  for (let d = dia(desde); dias.length < n; d = sumar(d, 1)) {
    const semana = d.getUTCDay();
    if (semana !== 0 && semana !== 6 && !fuera.has(iso(d))) dias.push(d);
  }
  return dias;
}

/** PRNG de las PRUEBAS (mulberry32), para no depender del que se prueba. */
export function azarDePrueba(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cierres con un retorno diario aleatorio de media `media` y amplitud `amplitud` (uniforme), desde `inicial`. */
export function serieAleatoria(dias: readonly Date[], inicial: number, semilla: number, media = 0.0003, amplitud = 0.02): Cierre[] {
  const azar = azarDePrueba(semilla);
  let precio = inicial;
  return dias.map((d, j) => {
    if (j > 0) precio *= 1 + media + (azar() - 0.5) * 2 * amplitud;
    return { dia: d, precio };
  });
}

/** Cierres con un factor diario constante. */
export const serieGeometrica = (dias: readonly Date[], inicial: number, factor: number): Cierre[] =>
  dias.map((d, j) => ({ dia: d, precio: inicial * factor ** j }));

export function accion(id: string, cantidad: number, cierres: readonly Cierre[], extra: Partial<AccionEntrada> = {}): AccionEntrada {
  return { tipo: "ACCION", instrumentoId: id, nombre: id.toUpperCase(), cantidad, cierres, dividendos: [], decretos: [], movimientos: [], ...extra };
}

export function fondo(id: string, unidades: number, valores: FondoEntrada["valores"]): FondoEntrada {
  return { tipo: "FONDO", instrumentoId: id, nombre: `Fondo ${id}`, unidades, valores };
}

/** Valores de unidad en TODOS los días calendario (como la SFC), con un factor diario constante. */
export function valoresDiarios(desde: string, n: number, inicial: number, factor: number): FondoEntrada["valores"] {
  return Array.from({ length: n }, (_, j) => ({ dia: sumar(dia(desde), j), valorUnidad: inicial * factor ** j }));
}

export function entradas(posiciones: EntradasProyeccion["posiciones"], extra: Partial<EntradasProyeccion> = {}): EntradasProyeccion {
  const ultimos = posiciones.flatMap((p) => (p.tipo === "ACCION" ? p.cierres.map((c) => c.dia) : p.valores.map((v) => v.dia)));
  const hoy = ultimos.length > 0 ? sumar(new Date(Math.max(...ultimos.map((d) => d.getTime()))), 1) : dia("2021-12-01");
  return { hoy, posiciones, escisiones: [], cierresDestino: {}, noHabiles: FESTIVOS_FICTICIOS, incompletas: [], ...extra };
}

/** Historia armada a mano: `factores[t][k]` y, si se dan, `rendimientos[t][k]`. */
export function historiaDe(factores: readonly (readonly number[])[], ruedasPorMes: number, rendimientos?: readonly (readonly number[])[]): Historia {
  const T = factores.length;
  const K = T > 0 ? factores[0]!.length : 0;
  const plano = (m: readonly (readonly number[])[]) => Float64Array.from(m.flatMap((fila) => [...fila]));
  return {
    dias: Array.from({ length: T + 1 }, (_, j) => iso(sumar(dia("2019-01-01"), j))),
    T,
    K,
    factores: plano(factores),
    rendimientos: rendimientos ? plano(rendimientos) : new Float64Array(T * K),
    ruedasPorMes,
  };
}

/** T días iguales: el mismo factor (y rendimiento) para cada una de las K columnas. */
export const historiaConstante = (T: number, K: number, factor: number, ruedasPorMes: number, rendimiento = 0): Historia =>
  historiaDe(
    Array.from({ length: T }, () => Array.from({ length: K }, () => factor)),
    ruedasPorMes,
    Array.from({ length: T }, () => Array.from({ length: K }, () => rendimiento)),
  );
