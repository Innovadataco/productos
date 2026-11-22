/**
 * Historia propia de una especie: `armarHistoria` (src/proyecciones/historia.ts) con esa sola acción, para reusar los
 * ajustes de escisión y de saltos y los dividendos. Exige MINIMO_DIAS días con cierre (src/proyecciones/metodo.ts).
 * Los destinos de escisión que también se tienen no vienen en `cierresDestino` (src/proyecciones/leer.ts): sus cierres
 * se pasan aquí, porque con una sola especie la historia no los vería.
 */
import { armarHistoria } from "../proyecciones/historia";
import type { AccionEntrada, AvisoCrudo, Cierre, EntradasProyeccion } from "../proyecciones/tipos";
import { caidaMaxima } from "./caida";
import { indicePrecio, rendimientosEnVentanas } from "./ventanas";
import type { HistoriaPropia } from "./tipos";

export interface ResultadoHistoriaPropia {
  readonly historia: HistoriaPropia;
  readonly avisos: readonly AvisoCrudo[];
}

/** Los cierres de los destinos que no se tienen (los trae el lector) y los de las acciones que sí. */
function cierresDeDestinos(e: EntradasProyeccion): Readonly<Record<string, readonly Cierre[]>> {
  const propias = e.posiciones.flatMap((p) => (p.tipo === "ACCION" ? [[p.instrumentoId, p.cierres] as const] : []));
  return { ...e.cierresDestino, ...Object.fromEntries(propias) };
}

export function historiaPropia(e: EntradasProyeccion, accion: AccionEntrada): ResultadoHistoriaPropia {
  const armado = armarHistoria({ ...e, posiciones: [accion], cierresDestino: cierresDeDestinos(e), incompletas: [] });
  const posicion = armado.posiciones[0]!;
  if (posicion.estado === "EXCLUIDA_SIN_VALOR") return { historia: { estado: "SIN_CIERRES" }, avisos: armado.avisos };
  if (posicion.estado === "FIJA_HISTORIA_CORTA") return { historia: { estado: "HISTORIA_CORTA", dias: posicion.diasTotales }, avisos: armado.avisos };
  const h = armado.historia;
  return {
    historia: {
      estado: "CON_HISTORIA", desde: h.dias[0]!, hasta: h.dias.at(-1)!, dias: posicion.diasTotales,
      ventanas: rendimientosEnVentanas(h), caidaMaxima: caidaMaxima(h.dias, indicePrecio(h)),
    },
    avisos: armado.avisos,
  };
}
