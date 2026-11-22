/**
 * El último cierre de cada especie frente a la fecha de referencia del tablero, con `frescuraDelCierre`
 * (src/plan/cierre-frescura.ts): la misma regla de /plan. El calendario se arma de los días no hábiles de la historia,
 * como `armarHistoria`: un año cuenta como sembrado si tiene algún día no hábil. Puro.
 */
import type { CalendarioBvc } from "../precios/negociacion";
import type { FilaTablero } from "../tablero/calculo";
import type { EstadoCierre } from "./tipos";

export function calendarioDe(noHabiles: readonly Date[]): CalendarioBvc {
  throw new Error("sin implementar");
}

export function estadoCierre(cierre: FilaTablero["cierre"], referencia: Date | null, calendario: CalendarioBvc): EstadoCierre {
  throw new Error("sin implementar");
}
