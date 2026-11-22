/**
 * El esquema de la salida de un modelo, igual para los tres tipos y las dos puertas: `{frases:[{texto, hechos:[ids]}]}`.
 * Es una constante en forma canónica (`clonCongelado`, como la copia `armarPedido`): lo que llega al generador es
 * exactamente esto, con las claves ordenadas («hechos» antes que «texto»).
 *
 * Sin restricciones de largo ni de forma (`minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`): rompen la
 * gramática de Ollama y la salida estructurada de Claude no las admite. Cada objeto cierra sus campos
 * (`additionalProperties: false`, que Claude exige). Los límites, los ids y todo lo demás los valida el validador al leer.
 */
import type { EsquemaSalida } from "../generador";
import { clonCongelado, jsonCanonico, sha256Hex } from "../hash";

export const ESQUEMA_SALIDA: EsquemaSalida = clonCongelado({
  type: "object",
  properties: {
    frases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          texto: { type: "string" },
          hechos: { type: "array", items: { type: "string" } },
        },
        required: ["texto", "hechos"],
        additionalProperties: false,
      },
    },
  },
  required: ["frases"],
  additionalProperties: false,
});

/** sha256 del JSON canónico del esquema: cambia si cambia el esquema (y con él, la versión del prompt). */
export const HASH_ESQUEMA_SALIDA = sha256Hex(jsonCanonico(ESQUEMA_SALIDA));
