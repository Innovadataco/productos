/**
 * «Qué movió su portafolio» (frente tablero-cierres). Cálculo puro y en Decimal, sin base de datos.
 * Todas las especies se comparan en el MISMO par de ruedas: la fecha de referencia del tablero y la
 * rueda anterior según el calendario de la BVC (salta sábados, domingos y festivos). Una especie
 * cuyos dos últimos cierres no son exactamente ese par (ilíquida, rezagada, una barra suelta en un día
 * no hábil, dos fuentes el mismo día) se omite y se cuenta: el neto nunca suma periodos distintos.
 * Si el calendario no tiene sembrado el año de la referencia o de la rueda previa, no se compara: sus
 * festivos serían invisibles y la rueda previa podría salir equivocada.
 * El aporte usa la cantidad viva de hoy (no la cantidad a la fecha de la rueda previa).
 */
import { Prisma } from "@prisma/client";
import type { FilaTablero } from "./calculo";

type Decimal = Prisma.Decimal;

const DIA_MS = 24 * 60 * 60 * 1000;
/** Ningún tramo real de días no hábiles se acerca a esto (Semana Santa con fin de semana son 4). */
const MAX_PASOS_RUEDA = 31;
const SABADO = 6;
const DOMINGO = 0;

export type MotivoSinComparar = "SIN_CIERRES" | "CALENDARIO_NO_CUBRE" | "REFERENCIA_NO_HABIL" | "SIN_RUEDA_PREVIA";

/** Lo que se sabe del calendario de la BVC: los días no hábiles (AAAA-MM-DD) y los años sembrados. */
export interface CalendarioBvc {
  readonly noHabiles: ReadonlySet<string>;
  readonly anios: ReadonlySet<number>;
}

export interface MovimientoEspecie {
  readonly instrumentoId: string;
  readonly nemotecnico: string;
  /** (cierre de la referencia − cierre de la rueda previa) × cantidad viva. */
  readonly aporte: Decimal;
  readonly variacionPct: Decimal;
}

export interface Movimiento {
  readonly referencia: Date | null;
  /** null si no se pudo comparar (ver `motivo`). */
  readonly previa: Date | null;
  /** De mayor a menor aporte absoluto; empate por nemotécnico. */
  readonly especies: readonly MovimientoEspecie[];
  /** Suma de los aportes; null si no entró ninguna especie (no es lo mismo que «no se movió»). */
  readonly neto: Decimal | null;
  /** Especies vivas que no entraron. */
  readonly omitidas: number;
  readonly motivo: MotivoSinComparar | null;
}

const clave = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Calendario desde las filas no hábiles de calendario_bvc. Un año cuenta como sembrado si tiene al
 * menos un día no hábil: todo año trae festivos entre semana (Ley 51 de 1983).
 */
export function calendarioDe(noHabiles: readonly Date[]): CalendarioBvc {
  return { noHabiles: new Set(noHabiles.map(clave)), anios: new Set(noHabiles.map((d) => d.getUTCFullYear())) };
}

/** Día hábil de la BVC: ni sábado, ni domingo, ni un día no hábil del calendario. */
export function esHabil(d: Date, noHabiles: ReadonlySet<string>): boolean {
  const dow = d.getUTCDay();
  return dow !== SABADO && dow !== DOMINGO && !noHabiles.has(clave(d));
}

/** Día hábil anterior a `d` (columnas DATE: medianoche UTC). null si el calendario no deja hallarlo. */
export function ruedaAnterior(d: Date, noHabiles: ReadonlySet<string>): Date | null {
  for (let paso = 1; paso <= MAX_PASOS_RUEDA; paso += 1) {
    const candidato = new Date(d.getTime() - paso * DIA_MS);
    if (esHabil(candidato, noHabiles)) return candidato;
  }
  return null;
}

/** El aporte de la especie si sus dos últimos cierres son exactamente (previa, referencia). */
function aporteEnPar(f: FilaTablero, previa: Date, referencia: Date): MovimientoEspecie | null {
  const ultimo = f.serie.at(-1);
  const anterior = f.serie.at(-2);
  if (!ultimo || !anterior) return null;
  if (ultimo.fecha.getTime() !== referencia.getTime() || anterior.fecha.getTime() !== previa.getTime()) return null;
  if (!anterior.precio.gt(0)) return null;
  return {
    instrumentoId: f.instrumentoId,
    nemotecnico: f.nemotecnico,
    aporte: ultimo.precio.sub(anterior.precio).mul(f.cantidad.toString()),
    variacionPct: ultimo.precio.div(anterior.precio).sub(1).mul(100),
  };
}

/** Comparación por código (igual en servidor y navegador). */
const porNemo = (a: MovimientoEspecie, b: MovimientoEspecie): number => (a.nemotecnico < b.nemotecnico ? -1 : a.nemotecnico > b.nemotecnico ? 1 : 0);
const porAporte = (a: MovimientoEspecie, b: MovimientoEspecie): number => b.aporte.abs().cmp(a.aporte.abs()) || porNemo(a, b);

const sinComparar = (vivas: number, referencia: Date | null, motivo: MotivoSinComparar): Movimiento =>
  ({ referencia, previa: null, especies: [], neto: null, omitidas: vivas, motivo });

/** `vivas`: las filas vivas del tablero; `referencia`: su fecha de referencia. */
export function calcularMovimiento(vivas: readonly FilaTablero[], referencia: Date | null, calendario: CalendarioBvc): Movimiento {
  const { noHabiles, anios } = calendario;
  if (referencia === null) return sinComparar(vivas.length, null, "SIN_CIERRES");
  if (!anios.has(referencia.getUTCFullYear())) return sinComparar(vivas.length, referencia, "CALENDARIO_NO_CUBRE");
  if (!esHabil(referencia, noHabiles)) return sinComparar(vivas.length, referencia, "REFERENCIA_NO_HABIL");
  const previa = ruedaAnterior(referencia, noHabiles);
  if (previa === null) return sinComparar(vivas.length, referencia, "SIN_RUEDA_PREVIA");
  if (!anios.has(previa.getUTCFullYear())) return sinComparar(vivas.length, referencia, "CALENDARIO_NO_CUBRE");
  const especies = vivas.flatMap((f) => aporteEnPar(f, previa, referencia) ?? []).sort(porAporte);
  const neto = especies.length > 0 ? especies.reduce((s, e) => s.add(e.aporte), new Prisma.Decimal(0)) : null;
  return { referencia, previa, especies, neto, omitidas: vivas.length - especies.length, motivo: null };
}
