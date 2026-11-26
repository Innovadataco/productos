/**
 * Los obligatorios del DIARIO los escribe el código. Para los tipos de `TIPOS_OBLIGATORIAS_DEL_CODIGO`, la salida del
 * modelo se compone con las frases de la plantilla para los obligatorios que ninguna de sus citas trae: primero las
 * del código, en el orden del paquete, y después las del modelo. Es determinista, y si el modelo ya cita todos no se
 * agrega nada. El resultado pasa por los mismos controles que cualquier salida (cada frase, sea de quien sea, y los
 * límites del conjunto): el validador solo decide con él si publica. Si las frases del código no caben en los límites,
 * el obligatorio queda sin citar y lo rechaza HECHO_NO_CITADO.OBLIGATORIO. Un nombre obligatorio que el modelo no cita y
 * que no va delante de un dato escrito por el código no se completa (el armador del DIARIO no marca nombres).
 */
import type { PaqueteHechos, TipoResumen } from "../contrato";
import { frasesDePlantilla } from "./frases-plantilla";
import { leerSalida, type FraseLeida, type SalidaLeida } from "./leer";
import { segmentosDe } from "./segmentos";

export const TIPOS_OBLIGATORIAS_DEL_CODIGO: readonly TipoResumen[] = Object.freeze(["DIARIO"] as const);

export interface SalidaCompuesta {
  /** Las frases que se validan: las del código y, después, las del modelo. */
  readonly frases: readonly FraseLeida[];
  /** Cuántas de las primeras frases las escribió el código. */
  readonly delCodigo: number;
}

/** Las frases del código como se leen de una salida: por el mismo camino que la plantilla (texto → segmentos → texto). */
function leerFrasesDelCodigo(textos: readonly string[]): readonly FraseLeida[] {
  const leida = leerSalida(JSON.stringify({ frases: textos.map((texto) => ({ segmentos: segmentosDe(texto) })) }));
  return leida?.frases ?? [];
}

export function componerConObligatorias(paquete: PaqueteHechos, modelo: SalidaLeida): SalidaCompuesta {
  const sinCambio: SalidaCompuesta = { frases: modelo.frases, delCodigo: 0 };
  if (!TIPOS_OBLIGATORIAS_DEL_CODIGO.includes(paquete.tipo)) return sinCambio;
  const citados = new Set(modelo.frases.flatMap((f) => f.hechos));
  const faltantes = paquete.hechos.filter((h) => h.obligatorio && !citados.has(h.id));
  if (faltantes.length === 0) return sinCambio;
  const delCodigo = leerFrasesDelCodigo(frasesDePlantilla(paquete, faltantes));
  return { frases: [...delCodigo, ...modelo.frases], delCodigo: delCodigo.length };
}
