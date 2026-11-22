/**
 * La hora de Colombia de un instante (frente fecha-hora-datos). Corre en los serializadores del servidor; la pantalla
 * recibe el texto ya hecho, así el servidor y el navegador pintan lo mismo. America/Bogota es UTC−5 todo el año (sin
 * horario de verano desde 1993): un desfase fijo, sin Intl ni la zona horaria del proceso. Lo prueba
 * tests/unit/fecha-dato/hora.test.ts contra Intl en America/Bogota.
 */
import type { InstanteColombia } from "./tipos";

const DESFASE_COLOMBIA_MS = 5 * 60 * 60 * 1000;
const INSTANTE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/;

/** «AAAA-MM-DD HH:MM» en Colombia; los segundos se cortan, no se redondean. */
export const horaColombia = (d: Date): InstanteColombia => new Date(d.getTime() - DESFASE_COLOMBIA_MS).toISOString().slice(0, 16).replace("T", " ");

/** El atributo `dateTime` de <time> para una hora de Colombia: «AAAA-MM-DDTHH:MM-05:00»; null si no tiene esa forma. */
export function dateTimeColombia(t: InstanteColombia): string | null {
  const m = INSTANTE.exec(t);
  return m ? `${m[1]}T${m[2]}-05:00` : null;
}
