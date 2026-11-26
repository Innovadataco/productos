/**
 * Cuántos días hábiles de la BVC lleva un cierre sin renovarse (frente fuente-retraso). Cuenta los días posteriores al
 * del cierre, hasta hoy (hora de Colombia), que son hábiles según calendario_bvc y cuya rueda ya cerró
 * (`barraDefinitiva`: hoy solo después de la hora definitiva). Puro: recibe el instante y el calendario.
 * Si el calendario no cubre un año del tramo, sus festivos son invisibles: ese año se cuenta con los días de semana
 * sin festivos (una COTA SUPERIOR del número real) y el resultado sale `aproximado`, con los años que faltan. Así el
 * aviso de dato viejo no se apaga al pasar el último año sembrado. Si la LECTURA del calendario falló (`respaldo`), lo dice
 * aparte: no se nombra un año. Un cierre de hace más del tope no se cuenta: se avisa «más de MAX_HABILES» (`tope`).
 */
import { barraDefinitiva, esDiaHabil, fechaEnBogota } from "./horario";
import type { CalendarioBvc } from "./negociacion";

const DIA_MS = 24 * 60 * 60 * 1000;
/** Un cierre más viejo que esto no se fecha: ningún dato real se acerca. */
const MAX_DIAS = 3660;
/** Desde cuántos días hábiles de atraso se avisa («más de un día hábil»). */
export const MINIMO_AVISO = 2;

/** Los días hábiles que se dicen de un cierre más viejo que el tope (≈ MAX_DIAS de calendario, sin fines de semana). */
export const MAX_HABILES = 2600;

/** El respaldo cuando no se puede leer calendario_bvc: sin festivos ni años cubiertos, así que todo sale aproximado. */
export const CALENDARIO_DE_RESPALDO: CalendarioBvc = { noHabiles: new Set(), aniosCubiertos: new Set(), respaldo: true };

export interface AtrasoHabil {
  readonly dias: number;
  /** Algún año del tramo no está en el calendario: `dias` es una cota superior (sin descontar festivos de esos años). */
  readonly aproximado: boolean;
  /** Los años del tramo sin calendario, sin repetir y en orden; vacío si el resultado es exacto. */
  readonly aniosSinFestivos: readonly number[];
  /** La lectura del calendario falló: `dias` es una cota superior sin saber qué años faltan. */
  readonly respaldo: boolean;
  /** El cierre es más viejo que el tope: `dias` es MAX_HABILES y se dice «más de». */
  readonly tope: boolean;
}

export function diasHabilesDeAtraso(diaCierre: Date, ahora: Date, calendario: CalendarioBvc): AtrasoHabil {
  const hoy = fechaEnBogota(ahora);
  const pasos = Math.round((hoy.getTime() - diaCierre.getTime()) / DIA_MS);
  if (pasos > MAX_DIAS) return { dias: MAX_HABILES, aproximado: true, aniosSinFestivos: [], respaldo: false, tope: true };
  let dias = 0;
  const sinCalendario = new Set<number>();
  for (let k = 1; k <= pasos; k += 1) {
    const d = new Date(diaCierre.getTime() + k * DIA_MS);
    const finDeSemana = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    if (finDeSemana) continue;
    if (!calendario.aniosCubiertos.has(d.getUTCFullYear())) sinCalendario.add(d.getUTCFullYear());
    if (esDiaHabil(d, calendario.noHabiles) && barraDefinitiva(d, ahora, calendario.noHabiles)) dias += 1;
  }
  const respaldo = calendario.respaldo === true;
  const aniosSinFestivos = respaldo ? [] : [...sinCalendario].sort((a, b) => a - b);
  return { dias, aproximado: respaldo || sinCalendario.size > 0, aniosSinFestivos, respaldo, tope: false };
}

/** El atraso para la pantalla: solo si pasa del mínimo; null si no hay que avisar. */
export const atrasoParaAviso = (diaCierre: Date, ahora: Date, calendario: CalendarioBvc): AtrasoHabil | null => {
  const a = diasHabilesDeAtraso(diaCierre, ahora, calendario);
  return a.dias >= MINIMO_AVISO ? a : null;
};

/** Lo que viaja a la pantalla (con el cierre): el número y, si es aproximado, por qué (años sin festivos, calendario no leído o tope). */
export function camposDeAtraso(a: AtrasoHabil | null): {
  readonly habilesAtras: number | null; readonly aniosSinFestivos?: readonly number[]; readonly calendarioNoLeido?: true; readonly masDelTope?: true;
} {
  if (a === null) return { habilesAtras: null };
  if (a.tope) return { habilesAtras: a.dias, masDelTope: true };
  if (a.respaldo) return { habilesAtras: a.dias, calendarioNoLeido: true };
  return a.aproximado ? { habilesAtras: a.dias, aniosSinFestivos: a.aniosSinFestivos } : { habilesAtras: a.dias };
}
