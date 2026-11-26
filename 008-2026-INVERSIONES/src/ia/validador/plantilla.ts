/**
 * Plantilla sin IA (nivel 0): el resumen cuando no hay modelo (o su salida se rechazó). Determinista y armada solo con
 * el paquete: la etiqueta del catálogo y la cita de cada hecho obligatorio (si no hay ninguno que no sea un nombre, el
 * primer hecho que no lo es), con el nombre de su especie delante («{S}: etiqueta {H}»), separados por «; » y repartidos
 * en frases dentro de los límites (`frases-plantilla.ts`). Sale en el MISMO formato que un modelo y pasa por el MISMO
 * validador (`resumenSinIa`): nada se publica sin él. Si los obligatorios no caben, el validador la rechaza (cierra en fallo).
 */
import type { PaqueteHechos, TipoResumen } from "../contrato";
import { esPaqueteConstruido } from "../paquete";
import { ErrorValidador } from "./codigos";
import { frasesDeLaPlantillaSinIa } from "./frases-plantilla";
import { segmentosDe } from "./segmentos";
import type { ResultadoValidacion } from "./tipos";
import { validarSalida } from "./validar";

export { frasesParaLosHechos } from "./frases-plantilla";

/** La salida cruda de la plantilla, en el formato del esquema `salida-v2` (los segmentos de cada frase: texto y refs). */
export function salidaDePlantilla(paquete: PaqueteHechos): string {
  if (!esPaqueteConstruido(paquete)) throw new ErrorValidador("PAQUETE_NO_CONSTRUIDO");
  const frases = frasesDeLaPlantillaSinIa(paquete).map((texto) => ({ segmentos: segmentosDe(texto) }));
  return JSON.stringify({ frases });
}

/** El resumen sin IA: la plantilla, pasada por el mismo validador que la salida de un modelo. */
export function resumenSinIa<T extends TipoResumen>(paquete: PaqueteHechos<T>): ResultadoValidacion<T> {
  return validarSalida(salidaDePlantilla(paquete), paquete);
}
