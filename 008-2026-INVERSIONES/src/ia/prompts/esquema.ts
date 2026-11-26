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
import type { TipoResumen } from "../contrato";
import type { EsquemaSalida } from "../generador";
import { clonCongelado, jsonCanonico, sha256Hex } from "../hash";

export const VERSION_ESQUEMA_SALIDA = "salida-v2";

/** El patrón de un id de hecho en el esquema; el mismo que `esIdHecho`. */
export const PATRON_REF_ESQUEMA = "^H[0-9]{2}$";

/** Una lista de `{segmentos:[{texto} | {ref}]}`: la forma de las frases y, en v3, de los ítems de `revisar`. */
const listaDeSegmentos = (): EsquemaSalida => ({
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
});

export const ESQUEMA_SALIDA: EsquemaSalida = clonCongelado({
  type: "object",
  properties: { frases: listaDeSegmentos() },
  required: ["frases"],
  additionalProperties: false,
});

/** sha256 del JSON canónico del esquema: cambia si cambia el esquema (y con él, la versión del prompt). */
export const HASH_ESQUEMA_SALIDA = sha256Hex(jsonCanonico(ESQUEMA_SALIDA));

/**
 * `salida-v3` (solo SIMULACION): el de v2 más `revisar`, los ítems nominales de «Para revisar» (el encabezado y la
 * numeración los pone el código). Mismos segmentos, mismas reglas de forma. Ningún tipo de hoy lo usa.
 */
export const VERSION_ESQUEMA_SALIDA_V3 = "salida-v3";

export const ESQUEMA_SALIDA_V3: EsquemaSalida = clonCongelado({
  type: "object",
  properties: { frases: listaDeSegmentos(), revisar: listaDeSegmentos() },
  required: ["frases", "revisar"],
  additionalProperties: false,
});

export const HASH_ESQUEMA_SALIDA_V3 = sha256Hex(jsonCanonico(ESQUEMA_SALIDA_V3));

/** El esquema de salida del tipo: v3 para SIMULACION y v2 para los tres de hoy. Un tipo desconocido: TypeError (falla cerrado). */
export function esquemaSalidaDe(tipo: TipoResumen): EsquemaSalida {
  if (tipo === "SIMULACION") return ESQUEMA_SALIDA_V3;
  if (tipo === "DIARIO" || tipo === "REGLAS" || tipo === "ESCENARIOS") return ESQUEMA_SALIDA;
  throw new TypeError("Tipo de resumen fuera del contrato.");
}
