/**
 * Lectura de la salida cruda `salida-v3` (solo SIMULACION): `{frases:[{segmentos}], revisar:[{segmentos}]}`. Igual que
 * `leerSalida` (v2): total (con cualquier entrada devuelve la salida leída o null, sin lanzar), solo un texto de hasta
 * MAX_SALIDA_CRUDA, JSON exacto sin campos de más (un `__proto__` es un campo de más) y el texto de cada frase y de cada
 * ítem lo arma el código con los segmentos. La forma v2 (sin `revisar`) no es v3: cada versión tiene su lector.
 */
import { MAX_SALIDA_CRUDA } from "../generador";
import { conCampos, leerFrase, type FraseLeida } from "./leer";

export interface SalidaLeidaV3 {
  readonly frases: readonly FraseLeida[];
  /** Los ítems de «Para revisar», armados igual que una frase. */
  readonly revisar: readonly FraseLeida[];
}

/** Una lista de `{segmentos}` leída entera, o null si algún elemento no es válido. */
function leerLista(valor: unknown): readonly FraseLeida[] | null {
  if (!Array.isArray(valor)) return null;
  const leidas: FraseLeida[] = [];
  for (const elemento of valor as readonly unknown[]) {
    const leida = leerFrase(elemento);
    if (leida === null) return null;
    leidas.push(leida);
  }
  return Object.freeze(leidas);
}

export function leerSalidaV3(salidaCruda: unknown): SalidaLeidaV3 | null {
  if (typeof salidaCruda !== "string" || salidaCruda.length > MAX_SALIDA_CRUDA) return null;
  let crudo: unknown;
  try {
    crudo = JSON.parse(salidaCruda);
  } catch {
    // JSON inválido (o demasiado anidado para el analizador): no es una salida del esquema.
    return null;
  }
  if (!conCampos(crudo, ["frases", "revisar"])) return null;
  const frases = leerLista(crudo.frases);
  const revisar = leerLista(crudo.revisar);
  if (frases === null || revisar === null) return null;
  return Object.freeze({ frases, revisar });
}
