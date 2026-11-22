/**
 * El último cierre de cada especie frente a la fecha de referencia del tablero, con `frescuraDelCierre`
 * (src/plan/cierre-frescura.ts): la misma regla de /plan. El calendario se arma de los días no hábiles de la historia,
 * como `armarHistoria`: un año cuenta como sembrado si tiene algún día no hábil. Puro.
 */
import { frescuraDelCierre } from "../plan/cierre-frescura";
import { diaIso } from "../precios/horario";
import type { CalendarioBvc } from "../precios/negociacion";
import type { FilaTablero } from "../tablero/calculo";
import type { EstadoCierre } from "./tipos";

export function calendarioDe(noHabiles: readonly Date[]): CalendarioBvc {
  return { noHabiles: new Set(noHabiles.map(diaIso)), aniosCubiertos: new Set(noHabiles.map((d) => d.getUTCFullYear())) };
}

export function estadoCierre(cierre: FilaTablero["cierre"], referencia: Date | null, calendario: CalendarioBvc): EstadoCierre {
  if (cierre === null) return { estado: "SIN_CIERRE" };
  const base = { dia: diaIso(cierre.fecha), precio: cierre.precio };
  const f = frescuraDelCierre(cierre.fecha, referencia, calendario);
  if (f.estado === "SIN_NEGOCIACION") return { estado: "SIN_NEGOCIACION", ...base, desde: diaIso(f.desde) };
  if (f.estado === "SIN_CALENDARIO") return { estado: "SIN_CALENDARIO", ...base, anio: f.anio };
  return { estado: "AL_DIA", ...base };
}
