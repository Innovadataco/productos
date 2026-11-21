/**
 * ¿El último cierre de una especie está al día? (fase B, corte 3; SPEC-13 «nunca un precio viejo como de hoy»). Puro.
 * Se compara con la fecha de referencia del tablero (el cierre más reciente entre las especies vivas): si entre el
 * último cierre de la especie y esa referencia hay días hábiles de la BVC sin cierre, la especie está «sin
 * negociación desde» el primero de ellos. Es una INFERENCIA: la base no guarda las barras omitidas por volumen 0,
 * así que una falla de Yahoo de un solo símbolo se vería igual (la pantalla lo dice al pie).
 * Si el calendario de la BVC no cubre un año del tramo, no se fecha (sus festivos serían invisibles).
 */
import { esDiaHabil } from "../precios/horario";
import type { CalendarioBvc } from "../precios/negociacion";
import { sumarDias } from "./fechas";

export type FrescuraCierre =
  | { readonly estado: "SIN_CIERRE" }
  | { readonly estado: "AL_DIA"; readonly ultimo: Date }
  | { readonly estado: "SIN_NEGOCIACION"; readonly desde: Date; readonly ultimo: Date }
  | { readonly estado: "SIN_CALENDARIO"; readonly ultimo: Date; readonly anio: number };

/** Ningún tramo real de días no hábiles se acerca a esto (Semana Santa con fin de semana son 4). */
const MAX_PASOS_ATRAS = 31;

const esFinDeSemana = (d: Date): boolean => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/** El primer día hábil en (desde, hasta], o el año que el calendario no cubre; null si no hay ninguno. */
function primerHabil(desde: Date, hasta: Date, calendario: CalendarioBvc): Date | { readonly anio: number } | null {
  for (let t = sumarDias(desde, 1); t <= hasta; t = sumarDias(t, 1)) {
    if (esFinDeSemana(t)) continue;
    if (!calendario.aniosCubiertos.has(t.getUTCFullYear())) return { anio: t.getUTCFullYear() };
    if (esDiaHabil(t, calendario.noHabiles)) return t;
  }
  return null;
}

export function frescuraDelCierre(ultimo: Date | null, referencia: Date | null, calendario: CalendarioBvc): FrescuraCierre {
  if (ultimo === null) return { estado: "SIN_CIERRE" };
  if (referencia === null || ultimo >= referencia) return { estado: "AL_DIA", ultimo };
  const primero = primerHabil(ultimo, referencia, calendario);
  if (primero === null) return { estado: "AL_DIA", ultimo };
  if (primero instanceof Date) return { estado: "SIN_NEGOCIACION", desde: primero, ultimo };
  return { estado: "SIN_CALENDARIO", ultimo, anio: primero.anio };
}

/** El último día hábil antes de `hoy`; null si el calendario no cubre ese tramo. */
function ultimoHabilAntes(hoy: Date, calendario: CalendarioBvc): Date | null {
  for (let paso = 1, t = sumarDias(hoy, -1); paso <= MAX_PASOS_ATRAS; paso += 1, t = sumarDias(t, -1)) {
    if (esFinDeSemana(t)) continue;
    if (!calendario.aniosCubiertos.has(t.getUTCFullYear())) return null;
    if (esDiaHabil(t, calendario.noHabiles)) return t;
  }
  return null;
}

/** ¿La carga de precios se detuvo? La referencia es anterior al último día hábil antes de hoy. */
export function preciosAtrasados(referencia: Date | null, hoy: Date, calendario: CalendarioBvc): boolean {
  if (referencia === null) return false;
  const ultimoHabil = ultimoHabilAntes(hoy, calendario);
  return ultimoHabil !== null && referencia < ultimoHabil;
}
