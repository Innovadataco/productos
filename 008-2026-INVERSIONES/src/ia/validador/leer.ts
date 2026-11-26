/**
 * Lectura de la salida cruda de un modelo (control SALIDA_INVALIDA), versión `salida-v2`. Total: con cualquier entrada
 * devuelve la salida leída o null, sin lanzar. Solo admite un texto de hasta MAX_SALIDA_CRUDA con el JSON exacto del
 * esquema, `{frases:[{segmentos:[{texto} | {ref}]}]}`, sin campos de más (un `__proto__` del JSON es un campo de más).
 * La forma vieja (`{texto, hechos}`) es SALIDA_INVALIDA. No toca un valor que no sea texto (un Proxy, p. ej., se
 * descarta solo por su `typeof`). Un texto con llaves (la cita no se escribe en la prosa) o una ref fuera del patrón
 * de id también lo es.
 *
 * El texto de cada frase lo arma el código: los segmentos unidos, con `{Hnn}` en el lugar de cada ref (`segmentos.ts`);
 * `hechos` son las refs, sin repetir, en orden. Devuelve una copia congelada.
 */
import { MAX_SALIDA_CRUDA } from "../generador";
import { esRef, segmentoValido, unirSegmentos, type Segmento } from "./segmentos";

export interface FraseLeida {
  /** La frase armada por el código: la prosa del modelo con la cita `{Hnn}` de cada ref. */
  readonly texto: string;
  /** Las refs de los segmentos, sin repetir, en orden: los hechos que cita la frase. */
  readonly hechos: readonly string[];
}

export interface SalidaLeida {
  readonly frases: readonly FraseLeida[];
}

type Registro = Readonly<Record<string, unknown>>;

/** Un objeto de JSON.parse (no arreglo ni null) con exactamente los campos dados. */
export function conCampos(valor: unknown, campos: readonly string[]): valor is Registro {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return false;
  const claves = Object.keys(valor);
  return claves.length === campos.length && campos.every((campo) => Object.hasOwn(valor, campo));
}

function leerSegmento(valor: unknown): Segmento | null {
  if (conCampos(valor, ["texto"])) return typeof valor.texto === "string" ? { texto: valor.texto } : null;
  if (conCampos(valor, ["ref"])) return typeof valor.ref === "string" ? { ref: valor.ref } : null;
  return null;
}

export function leerFrase(valor: unknown): FraseLeida | null {
  if (!conCampos(valor, ["segmentos"]) || !Array.isArray(valor.segmentos)) return null;
  const segmentos: Segmento[] = [];
  for (const crudo of valor.segmentos as readonly unknown[]) {
    const segmento = leerSegmento(crudo);
    if (segmento === null || !segmentoValido(segmento)) return null;
    segmentos.push(segmento);
  }
  const hechos = [...new Set(segmentos.filter(esRef).map((s) => s.ref))];
  return Object.freeze({ texto: unirSegmentos(segmentos), hechos: Object.freeze(hechos) });
}

export function leerSalida(salidaCruda: unknown): SalidaLeida | null {
  if (typeof salidaCruda !== "string" || salidaCruda.length > MAX_SALIDA_CRUDA) return null;
  let crudo: unknown;
  try {
    crudo = JSON.parse(salidaCruda);
  } catch {
    // JSON inválido (o demasiado anidado para el analizador): no es una salida del esquema.
    return null;
  }
  if (!conCampos(crudo, ["frases"]) || !Array.isArray(crudo.frases)) return null;
  const frases: FraseLeida[] = [];
  for (const valor of crudo.frases as readonly unknown[]) {
    const frase = leerFrase(valor);
    if (frase === null) return null;
    frases.push(frase);
  }
  return Object.freeze({ frases: Object.freeze(frases) });
}
