/**
 * Por qué una barra diaria de Yahoo NO es el cierre de su día (SPEC-13: «nunca un precio viejo como de hoy»).
 * Yahoo trae barras en festivos de la BVC (cierre repetido con volumen 0 o null) y en días hábiles sin
 * negociación (volumen 0, cierre repetido). Guardarlas sería presentar el precio viejo con fecha fresca.
 * Una sola razón por barra, en este orden:
 *   1. HORARIO: la barra aún no es definitiva (hoy antes de la hora, hoy no hábil o fecha futura).
 *   2. NO_HABIL: fin de semana o festivo de calendario_bvc.
 *   3. SIN_NEGOCIACION: volumen 0 (certeza de que no hubo negociación, haya calendario o no).
 *   4. SIN_CALENDARIO: día entre semana de un año sin filas en calendario_bvc: no se sabe si fue
 *      festivo, así que lo prudente es no guardar y reportarlo.
 * Con volumen null en un día hábil la barra se guarda (Yahoo no siempre trae el volumen).
 */
import { barraDefinitiva, diaIso, esDiaHabil } from "./horario";
import type { Cierre } from "./yahoo";

export type MotivoOmision = "HORARIO" | "NO_HABIL" | "SIN_NEGOCIACION" | "SIN_CALENDARIO";

export interface CalendarioBvc {
  readonly noHabiles: ReadonlySet<string>;
  /** Años con al menos una fila en calendario_bvc; los demás se consideran NO sembrados (como en la importación). */
  readonly aniosCubiertos: ReadonlySet<number>;
}

export interface FilaCalendario {
  readonly dia: Date;
  readonly esHabil: boolean;
}

export function leerCalendario(filas: readonly FilaCalendario[]): CalendarioBvc {
  return {
    noHabiles: new Set(filas.filter((f) => !f.esHabil).map((f) => diaIso(f.dia))),
    aniosCubiertos: new Set(filas.map((f) => f.dia.getUTCFullYear())),
  };
}

/** null si la barra es el cierre de su día; si no, la razón para no guardarla. */
export function motivoOmision(barra: Pick<Cierre, "fecha" | "volumen">, ahora: Date, calendario: CalendarioBvc): MotivoOmision | null {
  if (!barraDefinitiva(barra.fecha, ahora, calendario.noHabiles)) return "HORARIO";
  if (!esDiaHabil(barra.fecha, calendario.noHabiles)) return "NO_HABIL";
  if (barra.volumen === 0) return "SIN_NEGOCIACION";
  if (!calendario.aniosCubiertos.has(barra.fecha.getUTCFullYear())) return "SIN_CALENDARIO";
  return null;
}
