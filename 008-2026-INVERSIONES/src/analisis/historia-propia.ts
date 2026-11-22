/**
 * Historia propia de una especie: `armarHistoria` (src/proyecciones/historia.ts) con esa sola acción, para reusar los
 * ajustes de escisión y de saltos y los dividendos. Exige MINIMO_DIAS días con cierre (src/proyecciones/metodo.ts).
 * Los destinos de escisión que también se tienen no vienen en `cierresDestino` (src/proyecciones/leer.ts): sus cierres
 * se pasan aquí, porque con una sola especie la historia no los vería.
 */
import type { AccionEntrada, AvisoCrudo, EntradasProyeccion } from "../proyecciones/tipos";
import type { HistoriaPropia } from "./tipos";

export interface ResultadoHistoriaPropia {
  readonly historia: HistoriaPropia;
  readonly avisos: readonly AvisoCrudo[];
}

export function historiaPropia(e: EntradasProyeccion, accion: AccionEntrada): ResultadoHistoriaPropia {
  throw new Error("sin implementar");
}
