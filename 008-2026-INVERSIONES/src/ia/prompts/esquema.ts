/**
 * `salida-v2`: el esquema de la salida de un modelo, igual para los tres tipos y las dos puertas:
 * `{frases:[{segmentos:[{texto} | {ref}]}]}`. Un segmento de texto lleva prosa; un segmento de referencia lleva solo el
 * id de un hecho («H» y dos dígitos). El modelo NUNCA escribe la referencia dentro de la prosa: el código arma la frase
 * (`validador/segmentos.ts`) y el render intercala la presentación del hecho del paquete.
 * Es una constante en forma canónica (`clonCongelado`, como la copia `armarPedido`).
 *
 * Sin `minLength`, `maxLength`, `minItems` ni `maxItems`: rompen la gramática de Ollama y la salida estructurada de
 * Claude no los admite. Solo `ref` lleva `pattern` (el id, acotado; PI y la prueba contra Ollama real lo confirman o
 * se quita: el validador revisa la ref de todos modos con `PATRON_REF`). Cada objeto cierra sus campos
 * (`additionalProperties: false`, que Claude exige). Los límites y todo lo demás los valida el validador al leer.
 */
import type { EsquemaSalida } from "../generador";
import { clonCongelado, jsonCanonico, sha256Hex } from "../hash";

export const VERSION_ESQUEMA_SALIDA = "salida-v2";

/** El patrón de un id de hecho en el esquema; el mismo que `esIdHecho`. */
export const PATRON_REF_ESQUEMA = "^H[0-9]{2}$";

export const ESQUEMA_SALIDA: EsquemaSalida = clonCongelado({
  type: "object",
  properties: {
    frases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          segmentos: {
            type: "array",
            items: {
              anyOf: [
                { type: "object", properties: { texto: { type: "string" } }, required: ["texto"], additionalProperties: false },
                { type: "object", properties: { ref: { type: "string", pattern: PATRON_REF_ESQUEMA } }, required: ["ref"], additionalProperties: false },
              ],
            },
          },
        },
        required: ["segmentos"],
        additionalProperties: false,
      },
    },
  },
  required: ["frases"],
  additionalProperties: false,
});

/** sha256 del JSON canónico del esquema: cambia si cambia el esquema (y con él, la versión del prompt). */
export const HASH_ESQUEMA_SALIDA = sha256Hex(jsonCanonico(ESQUEMA_SALIDA));
