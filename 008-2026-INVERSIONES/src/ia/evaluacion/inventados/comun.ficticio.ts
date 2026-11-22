/**
 * Piezas comunes de las entradas INVENTADAS del arnés (E7): el azar con semilla (`crearPrng` del motor de proyecciones),
 * los días hábiles de 2027 con los festivos que siembra la migración del calendario BVC, nombres FICTICIA-* y cifras
 * con decimales (nunca redondas). Nada sale de una base ni de datos reales.
 */
import { Prisma } from "@prisma/client";
import type { Prng } from "../../../proyecciones/prng";
import type { CalendarioBvc } from "../../../precios/negociacion";

/** Los festivos de 2027 que siembra la migración del calendario BVC (lunes festivos de la ley Emiliani incluidos). */
const FESTIVOS_2027 = Object.freeze([
  "2027-01-01", "2027-01-11", "2027-03-22", "2027-03-25", "2027-03-26", "2027-05-10", "2027-05-31", "2027-06-07",
  "2027-07-05", "2027-07-20", "2027-08-16", "2027-10-18", "2027-11-01", "2027-11-15", "2027-12-08",
]);
const ANIO = 2027;

export const CALENDARIO_INVENTADO: CalendarioBvc = Object.freeze({ noHabiles: new Set(FESTIVOS_2027), aniosCubiertos: new Set([ANIO]) });

const LETRAS = Object.freeze([
  "ALFA", "BETA", "GAMMA", "DELTA", "EPSILON", "ZETA", "ETA", "THETA", "IOTA", "KAPPA", "LAMBDA", "MU",
  "NU", "XI", "OMICRON", "RHO", "SIGMA", "TAU", "UPSILON", "PHI", "CHI", "PSI", "OMEGA",
]);

const MS_POR_DIA = 86_400_000;
const PRIMER_DIA_HOY = "2027-02-01";
const ULTIMO_DIA_HOY = "2027-08-31";
const MULTIPLO_REDONDO = 100;
const DESVIO_NO_REDONDO = 0.37;

export const dia = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
export const iso = (fecha: Date): string => fecha.toISOString().slice(0, 10);
export const sumarDiasIso = (desde: string, dias: number): string => iso(new Date(dia(desde).getTime() + dias * MS_POR_DIA));

export function esHabil(diaIso: string): boolean {
  const semana = dia(diaIso).getUTCDay();
  return semana !== 0 && semana !== 6 && !CALENDARIO_INVENTADO.noHabiles.has(diaIso);
}

/** `n` días hábiles antes (n < 0) o después (n > 0) de un día; con 0, el mismo día. */
export function habilDesde(desde: string, n: number): string {
  let actual = desde;
  let faltan = Math.abs(n);
  while (faltan > 0) {
    actual = sumarDiasIso(actual, Math.sign(n));
    if (esHabil(actual)) faltan -= 1;
  }
  return actual;
}

/** Un día del año sin pasar del 31 de diciembre ni bajar del 2 de enero. */
export const dentroDelAnio = (diaIso: string): string => (diaIso > `${ANIO}-12-31` ? `${ANIO}-12-31` : diaIso < `${ANIO}-01-02` ? `${ANIO}-01-02` : diaIso);

export const entero = (p: Prng, min: number, max: number): number => min + p.enteroMenorQue(max - min + 1);
export const real = (p: Prng, min: number, max: number): number => min + p.uniforme() * (max - min);
export const siQue = (p: Prng, probabilidad: number): boolean => p.uniforme() < probabilidad;
export const elegir = <T>(p: Prng, lista: readonly T[]): T => lista[p.enteroMenorQue(lista.length)] as T;

/** Un día hábil de 2027 para `hoy`, entre febrero y agosto (así los plazos y los pagos caben en 2027). */
export function hoyInventado(p: Prng): string {
  const candidato = sumarDiasIso(PRIMER_DIA_HOY, p.enteroMenorQue((dia(ULTIMO_DIA_HOY).getTime() - dia(PRIMER_DIA_HOY).getTime()) / MS_POR_DIA));
  return esHabil(candidato) ? candidato : habilDesde(candidato, 1);
}

/** `n` nombres FICTICIA-* distintos, en un orden al azar (Fisher–Yates con la semilla). */
export function nombres(p: Prng, n: number): readonly string[] {
  const lista = [...LETRAS];
  for (let i = lista.length - 1; i > 0; i -= 1) {
    const j = p.enteroMenorQue(i + 1);
    [lista[i], lista[j]] = [lista[j] as string, lista[i] as string];
  }
  return lista.slice(0, Math.min(n, lista.length)).map((letra) => `FICTICIA-${letra}`);
}

export const instrumento = (nombre: string): string => `inst-inventado-${nombre.toLowerCase()}`;

/** El número con `decimales`, corrido un poco si quedara redondo (múltiplo de cien sin fracción). */
export function noRedondo(valor: number, decimales: number): number {
  const fijo = Number(valor.toFixed(decimales));
  return Math.abs(fijo) >= MULTIPLO_REDONDO && Number.isInteger(fijo) && fijo % MULTIPLO_REDONDO === 0 ? fijo + DESVIO_NO_REDONDO : fijo;
}

export const decimal = (valor: number, decimales: number): Prisma.Decimal => new Prisma.Decimal(noRedondo(valor, decimales).toFixed(decimales));
