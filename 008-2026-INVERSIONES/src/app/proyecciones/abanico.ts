/**
 * El abanico de la pantalla de proyecciones (frente proyecciones-pantalla). Puro.
 * - Eje: los días de la historia mensual antes de hoy, hoy y un día por mes proyectado (hoy + m meses, al final del mes
 *   si ese día no existe). El mes m del motor termina en la rueda round(m · ruedasPorMes): la fecha es aproximada y
 *   la pantalla la nombra «Mes m».
 * - Series: la historia solo antes de hoy y la proyección desde hoy; nunca una línea que las una.
 * - Plano: 6 curvas × 121 meses para interpolar un resultado hacia el siguiente aunque cambie el horizonte; más allá
 *   del horizonte se repite el último mes (el abanico crece o se recoge desde ahí, sin saltar).
 */
import type { PuntoHistoria } from "./historia";
import { HORIZONTE_MAX_MESES } from "./opciones";
import type { PuntoVista, VistaProyeccion } from "./vista";

const DIA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const dos = (n: number) => String(n).padStart(2, "0");

export function sumarMeses(dia: string, meses: number): string {
  const m = DIA_ISO.exec(dia);
  if (!m) return dia;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + meses;
  const [anio, mes] = [Math.floor(total / 12), total % 12];
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return `${anio}-${dos(mes + 1)}-${dos(Math.min(Number(m[3]), ultimo))}`;
}

type Curva = readonly (number | null)[];

export interface Abanico {
  readonly dias: readonly string[];
  readonly indiceHoy: number;
  /** El mes proyectado de cada día; null en la historia. */
  readonly mes: readonly (number | null)[];
  readonly real: Curva;
  readonly p5: Curva;
  readonly p25: Curva;
  readonly p50: Curva;
  readonly p75: Curva;
  readonly p95: Curva;
  readonly aportado: Curva;
}

export const CURVAS = ["p5", "p25", "p50", "p75", "p95", "aportado"] as const;
export type NombreCurva = (typeof CURVAS)[number];
export type Curvas = Readonly<Record<NombreCurva, readonly number[]>>;

const curvasDe = (puntos: readonly PuntoVista[]): Curvas =>
  Object.fromEntries(CURVAS.map((c) => [c, puntos.map((p) => p[c])])) as Record<NombreCurva, number[]>;

/** El abanico de la historia y una proyección; `curvas` (de la interpolación) reemplaza los valores proyectados. */
export function armarAbanico(historia: readonly PuntoHistoria[], vista: VistaProyeccion, curvas: Curvas = curvasDe(vista.puntos)): Abanico {
  const previa = historia.filter((p) => p.dia < vista.hoy);
  const enHoy = historia.find((p) => p.dia === vista.hoy) ?? null;
  const meses = vista.puntos.map((p) => p.mes);
  const dias = [...previa.map((p) => p.dia), ...meses.map((m) => sumarMeses(vista.hoy, m))];
  const antes = previa.length;
  const vacia = (): (number | null)[] => Array<number | null>(antes).fill(null);
  const proyectada = (c: NombreCurva): Curva => [...vacia(), ...meses.map((_, k) => curvas[c][k] ?? null)];
  const real = meses.length === 0 ? previa.map((p) => p.valor) : [...previa.map((p) => p.valor), enHoy?.valor ?? null, ...meses.slice(1).map(() => null)];
  return {
    dias, indiceHoy: antes, mes: [...vacia(), ...meses], real,
    p5: proyectada("p5"), p25: proyectada("p25"), p50: proyectada("p50"), p75: proyectada("p75"), p95: proyectada("p95"), aportado: proyectada("aportado"),
  };
}

export const MESES_PLANO = HORIZONTE_MAX_MESES + 1;

/** Las 6 curvas en un arreglo de tamaño fijo, cada una extendida con su último mes. Sin puntos, ceros. */
export function aPlano(puntos: readonly PuntoVista[]): number[] {
  const plano: number[] = [];
  for (const c of CURVAS) {
    const ultimo = puntos.at(-1)?.[c] ?? 0;
    for (let m = 0; m < MESES_PLANO; m += 1) plano.push(puntos[m]?.[c] ?? ultimo);
  }
  return plano;
}

/** Las curvas del horizonte pedido (0…horizonte) desde un plano. */
export function dePlano(plano: readonly number[], horizonte: number): Curvas {
  const n = Math.min(horizonte, MESES_PLANO - 1) + 1;
  return Object.fromEntries(CURVAS.map((c, k) => [c, plano.slice(k * MESES_PLANO, k * MESES_PLANO + n)])) as Record<NombreCurva, number[]>;
}
