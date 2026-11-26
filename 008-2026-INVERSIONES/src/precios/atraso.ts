/**
 * Cuántos días hábiles de la BVC lleva un cierre sin renovarse (frente fuente-retraso). Cuenta los días posteriores al
 * del cierre, hasta hoy (hora de Colombia), que son hábiles según calendario_bvc y cuya rueda ya cerró
 * (`barraDefinitiva`: hoy solo después de la hora definitiva). Puro: recibe el instante y el calendario.
 * Si el calendario no cubre un año del tramo, sus festivos son invisibles: ese año se cuenta con los días de semana
 * sin festivos (una COTA SUPERIOR del número real) y el resultado sale `aproximado`, con los años que faltan. Así el
 * aviso de dato viejo no se apaga al pasar el último año sembrado. Es null solo si el cierre es de hace más de diez años.
 */
import { barraDefinitiva, esDiaHabil, fechaEnBogota } from "./horario";
import type { CalendarioBvc } from "./negociacion";

const DIA_MS = 24 * 60 * 60 * 1000;
/** Un cierre más viejo que esto no se fecha: ningún dato real se acerca. */
const MAX_DIAS = 3660;
/** Desde cuántos días hábiles de atraso se avisa («más de un día hábil»). */
export const MINIMO_AVISO = 2;

/** El respaldo cuando no se puede leer calendario_bvc: sin festivos ni años cubiertos, así que todo sale aproximado. */
export const CALENDARIO_DE_RESPALDO: CalendarioBvc = { noHabiles: new Set(), aniosCubiertos: new Set() };

export interface AtrasoHabil {
  readonly dias: number;
  /** Algún año del tramo no está en el calendario: `dias` es una cota superior (sin descontar festivos de esos años). */
  readonly aproximado: boolean;
  /** Los años del tramo sin calendario, sin repetir y en orden; vacío si el resultado es exacto. */
  readonly aniosSinFestivos: readonly number[];
}

export function diasHabilesDeAtraso(diaCierre: Date, ahora: Date, calendario: CalendarioBvc): AtrasoHabil | null {
  const hoy = fechaEnBogota(ahora);
  const pasos = Math.round((hoy.getTime() - diaCierre.getTime()) / DIA_MS);
  if (pasos > MAX_DIAS) return null;
  let dias = 0;
  const sinCalendario = new Set<number>();
  for (let k = 1; k <= pasos; k += 1) {
    const d = new Date(diaCierre.getTime() + k * DIA_MS);
    const finDeSemana = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    if (finDeSemana) continue;
    if (!calendario.aniosCubiertos.has(d.getUTCFullYear())) sinCalendario.add(d.getUTCFullYear());
    if (esDiaHabil(d, calendario.noHabiles) && barraDefinitiva(d, ahora, calendario.noHabiles)) dias += 1;
  }
  const aniosSinFestivos = [...sinCalendario].sort((a, b) => a - b);
  return { dias, aproximado: aniosSinFestivos.length > 0, aniosSinFestivos };
}

/** El atraso para la pantalla: solo si pasa del mínimo; null si no hay que avisar. */
export const atrasoParaAviso = (diaCierre: Date, ahora: Date, calendario: CalendarioBvc): AtrasoHabil | null => {
  const a = diasHabilesDeAtraso(diaCierre, ahora, calendario);
  return a !== null && a.dias >= MINIMO_AVISO ? a : null;
};

/** Lo que viaja a la pantalla (con el cierre): el número y, si es aproximado, los años sin festivos. */
export function camposDeAtraso(a: AtrasoHabil | null): { readonly habilesAtras: number | null; readonly aniosSinFestivos?: readonly number[] } {
  if (a === null) return { habilesAtras: null };
  return a.aproximado ? { habilesAtras: a.dias, aniosSinFestivos: a.aniosSinFestivos } : { habilesAtras: a.dias };
}
