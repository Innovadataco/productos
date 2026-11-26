/**
 * Cuántos días hábiles de la BVC lleva un cierre sin renovarse (frente fuente-retraso). Cuenta los días posteriores al
 * del cierre, hasta hoy (hora de Colombia), que son hábiles según calendario_bvc y cuya rueda ya cerró
 * (`barraDefinitiva`: hoy solo después de la hora definitiva). Puro: recibe el instante y el calendario.
 * Es null si no se puede saber: el calendario no cubre un año del tramo (sus festivos serían invisibles).
 */
import { barraDefinitiva, esDiaHabil, fechaEnBogota } from "./horario";
import type { CalendarioBvc } from "./negociacion";

const DIA_MS = 24 * 60 * 60 * 1000;
/** Un cierre más viejo que esto no se fecha: ningún dato real se acerca. */
const MAX_DIAS = 3660;
/** Desde cuántos días hábiles de atraso se avisa («más de un día hábil»). */
export const MINIMO_AVISO = 2;

export function diasHabilesDeAtraso(diaCierre: Date, ahora: Date, calendario: CalendarioBvc): number | null {
  const hoy = fechaEnBogota(ahora);
  const pasos = Math.round((hoy.getTime() - diaCierre.getTime()) / DIA_MS);
  if (pasos > MAX_DIAS) return null;
  let habiles = 0;
  for (let k = 1; k <= pasos; k += 1) {
    const d = new Date(diaCierre.getTime() + k * DIA_MS);
    const finDeSemana = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    if (finDeSemana) continue;
    if (!calendario.aniosCubiertos.has(d.getUTCFullYear())) return null;
    if (esDiaHabil(d, calendario.noHabiles) && barraDefinitiva(d, ahora, calendario.noHabiles)) habiles += 1;
  }
  return habiles;
}

/** El aviso para la pantalla: el número de días hábiles si pasa del mínimo; null si no hay que avisar. */
export const atrasoParaAviso = (diaCierre: Date, ahora: Date, calendario: CalendarioBvc): number | null => {
  const n = diasHabilesDeAtraso(diaCierre, ahora, calendario);
  return n !== null && n >= MINIMO_AVISO ? n : null;
};
