/**
 * Lectura de la salida cruda de un modelo (control SALIDA_INVALIDA). Total: con cualquier entrada devuelve la salida
 * leída o null, sin lanzar. Solo admite un texto de hasta MAX_SALIDA_CRUDA con el JSON exacto del esquema,
 * `{frases:[{texto, hechos:[texto]}]}`, sin campos de más (un `__proto__` del JSON es un campo de más). No toca un
 * valor que no sea texto (un Proxy, p. ej., se descarta solo por su `typeof`). Devuelve una copia congelada.
 */
import { MAX_SALIDA_CRUDA } from "../generador";

export interface FraseLeida {
  readonly texto: string;
  readonly hechos: readonly string[];
}

export interface SalidaLeida {
  readonly frases: readonly FraseLeida[];
}

type Registro = Readonly<Record<string, unknown>>;

/** Un objeto de JSON.parse (no arreglo ni null) con exactamente los campos dados. */
function conCampos(valor: unknown, campos: readonly string[]): valor is Registro {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return false;
  const claves = Object.keys(valor);
  return claves.length === campos.length && campos.every((campo) => Object.hasOwn(valor, campo));
}

function leerFrase(valor: unknown): FraseLeida | null {
  if (!conCampos(valor, ["texto", "hechos"])) return null;
  const { texto, hechos } = valor;
  if (typeof texto !== "string" || !Array.isArray(hechos)) return null;
  const ids: string[] = [];
  for (const id of hechos as readonly unknown[]) {
    if (typeof id !== "string") return null;
    ids.push(id);
  }
  return Object.freeze({ texto, hechos: Object.freeze(ids) });
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
