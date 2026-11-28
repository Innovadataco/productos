/**
 * Los obligatorios del DIARIO los escribe el código. Para los tipos de `TIPOS_OBLIGATORIAS_DEL_CODIGO`, la salida del
 * modelo se compone con las frases de la plantilla para los obligatorios que ninguna de sus citas trae: primero las
 * del código, en el orden del paquete, y después las del modelo. Es determinista, y si el modelo ya cita todos no se
 * agrega nada. El resultado pasa por los mismos controles que cualquier salida (cada frase, sea de quien sea, y los
 * límites del conjunto): el validador solo decide con él si publica. Si las frases del código no caben en los límites,
 * el obligatorio queda sin citar y lo rechaza HECHO_NO_CITADO.OBLIGATORIO.
 *
 * El modelo tiene que aportar: al menos una frase suya cita un hecho que no es obligatorio ni un nombre (`aportaElModelo`);
 * si no, el texto sería la plantilla publicada como IA. La salida que es exactamente la plantilla sin IA queda exenta
 * (es el nivel 0, no un modelo).
 *
 * Un nombre de especie obligatorio que el modelo no cita se pasa a `frasesParaLosHechos` junto con los datos faltantes:
 * va dentro de una frase solo si va delante de uno de esos datos; si no, queda sin citar y lo rechaza
 * HECHO_NO_CITADO.OBLIGATORIO (el armador del DIARIO no marca nombres, así que no ocurre hoy).
 */
import type { PaqueteHechos, TipoResumen } from "../contrato";
import { frasesDeLaPlantillaSinIa, frasesParaLosHechos } from "./frases-plantilla";
import { esNombre, hechosPorId } from "./hechos";
import { leerSalida, type FraseLeida, type SalidaLeida } from "./leer";
import { segmentosDe } from "./segmentos";

export const TIPOS_OBLIGATORIAS_DEL_CODIGO: readonly TipoResumen[] = Object.freeze(["DIARIO"] as const);

/** ¿Los obligatorios de este tipo los escribe el código? */
export const escribeElCodigo = (tipo: TipoResumen): boolean => TIPOS_OBLIGATORIAS_DEL_CODIGO.includes(tipo);

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
  if (!escribeElCodigo(paquete.tipo)) return sinCambio;
  const citados = new Set(modelo.frases.flatMap((f) => f.hechos));
  const faltantes = paquete.hechos.filter((h) => h.obligatorio && !citados.has(h.id));
  if (faltantes.length === 0) return sinCambio;
  const delCodigo = leerFrasesDelCodigo(frasesParaLosHechos(paquete, faltantes));
  return { frases: [...delCodigo, ...modelo.frases], delCodigo: delCodigo.length };
}

/** ¿Alguna frase del modelo cita un hecho que no es obligatorio ni un nombre, o la salida es la plantilla sin IA? */
export function aportaElModelo(paquete: PaqueteHechos, modelo: SalidaLeida): boolean {
  const porId = hechosPorId(paquete);
  const aporta = modelo.frases.some((f) => f.hechos.some((id) => {
    const h = porId.get(id);
    return h !== undefined && !h.obligatorio && !esNombre(h);
  }));
  if (aporta) return true;
  const plantilla = frasesDeLaPlantillaSinIa(paquete);
  const mismas = leerFrasesDelCodigo(plantilla).map((f) => f.texto);
  return mismas.length > 0 && mismas.length === modelo.frases.length && mismas.every((t, i) => t === modelo.frases[i]?.texto);
}
