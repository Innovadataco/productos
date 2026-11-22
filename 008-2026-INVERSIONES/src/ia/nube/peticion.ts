import "server-only";
/**
 * El cuerpo del pedido a la API de mensajes de Claude, armado SOLO con el pedido de generación (nunca con el paquete):
 * - `system`: el texto exacto del prompt versionado (su hash lo calculó `armarPedido`); el cliente no agrega texto;
 * - el único mensaje: el JSON canónico de la vista ciega, revisado aquí otra vez antes de salir a internet;
 * - `claude-opus-5-5` (no se baja de modelo por costo: lo decide Jelk), sin `fallbacks` a otro modelo;
 * - pensamiento adaptativo (en Opus 5.5 no se puede apagar: `disabled` y `budget_tokens` dan 400) con esfuerzo bajo:
 *   la documentación de la skill claude-api recomienda `low` para tareas simples y cuando importan la latencia y el
 *   costo; aquí el modelo solo redacta de cuatro a seis frases citando ids, sin cálculo. Se mide en la evaluación E7;
 * - `max_tokens` con holgura: el pensamiento cuenta dentro de `max_tokens` y una salida cortada se paga igual;
 * - salida estructurada (`output_config.format`) con el esquema del pedido pasado a la forma estricta de la API por el
 *   transformador del SDK (`additionalProperties: false` en todo objeto; lo que la API no impone, como `maxItems`, va a
 *   la descripción y lo valida el validador al leer);
 * - sin `temperature`, `top_p` ni `top_k` (400 en Opus 5.5 y en la versión de API que manda el SDK).
 *
 * Nunca lanza: un pedido que no debe salir devuelve su código.
 */
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";
import { CAMPOS_HECHO_CIEGO, CAMPOS_PAQUETE_CIEGO, TIPOS_RESUMEN } from "../contrato";
import { esDe, esObjetoPlano, soloCampos, sonDatosPuros } from "../formas";
import { revisarPedido, type PedidoGeneracion } from "../generador";
import { clonCongelado, jsonCanonico } from "../hash";

export const MODELO_NUBE = "claude-opus-5-5";
export const MAX_TOKENS_NUBE = 8192;
export const ESFUERZO_NUBE = "low";

/** El cuerpo, con el tipo del SDK. */
export type CuerpoNube = MessageCreateParamsNonStreaming;

/** Las opciones de cada pedido: la señal del orquestador, el límite del pedido y ningún reintento. */
export interface OpcionesPedidoNube {
  readonly signal: AbortSignal;
  readonly timeout: number;
  readonly maxRetries: 0;
}

/** Lo que el generador usa del cliente del SDK (el real, o un doble en las pruebas). */
export interface ClienteMensajes {
  readonly messages: {
    create(cuerpo: CuerpoNube, opciones: OpcionesPedidoNube): PromiseLike<unknown>;
  };
}

export type DetalleCuerpoNoArmado = "PEDIDO_INVALIDO" | "VISTA_NO_CIEGA" | "ESQUEMA_NO_ADMITIDO";

export type CuerpoArmado =
  /** `json` es exactamente `JSON.stringify(cuerpo)`, lo que el SDK manda por el cable (con él se mide la cota). */
  | { readonly ok: true; readonly cuerpo: CuerpoNube; readonly json: string; readonly limiteMs: number }
  | { readonly ok: false; readonly detalle: DetalleCuerpoNoArmado };

/** Los ids son la única cifra permitida, y solo como valor completo de un campo («"H07"»). */
const ID_COMO_TEXTO = /"H[0-9]{2}"/g;
const CUALQUIER_DIGITO = /\p{N}/u;
const CAMPOS_EXIGIDOS_HECHO: readonly string[] = CAMPOS_HECHO_CIEGO.filter((campo) => campo !== "sujeto");

function hechoCiegoValido(hecho: unknown): boolean {
  if (!esObjetoPlano(hecho) || !soloCampos(hecho, CAMPOS_HECHO_CIEGO)) return false;
  if (!CAMPOS_EXIGIDOS_HECHO.every((campo) => Object.hasOwn(hecho, campo))) return false;
  return Object.entries(hecho).every(([campo, valor]) => (campo === "obligatorio" ? typeof valor === "boolean" : typeof valor === "string"));
}

/**
 * El JSON canónico de la vista (lo que se envía), o null si no tiene la forma de una vista ciega: solo el tipo y los
 * hechos con los campos ciegos, valores de texto (y `obligatorio` booleano), datos puros y ningún dígito fuera de los
 * ids. Se serializa una sola vez: lo revisado es lo que sale.
 */
export function vistaParaNube(vista: unknown): string | null {
  if (!sonDatosPuros(vista) || !esObjetoPlano(vista) || !soloCampos(vista, CAMPOS_PAQUETE_CIEGO)) return null;
  const { tipo, hechos } = vista;
  if (!esDe(TIPOS_RESUMEN, tipo) || !Array.isArray(hechos) || !hechos.every(hechoCiegoValido)) return null;
  const json = jsonCanonico(vista);
  return CUALQUIER_DIGITO.test(json.replace(ID_COMO_TEXTO, '""')) ? null : json;
}

/** El esquema en la forma estricta de la API, copiado en datos canónicos; null si el SDK no lo sabe transformar. */
function esquemaEstricto(esquema: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | null {
  try {
    return clonCongelado(transformJSONSchema(esquema) as Record<string, unknown>);
  } catch {
    return null;
  }
}

function revisado(pedido: PedidoGeneracion): PedidoGeneracion | null {
  try {
    return revisarPedido(pedido);
  } catch {
    return null;
  }
}

/** El cuerpo congelado del pedido, o el código de por qué no sale. */
export function armarCuerpoNube(pedido: PedidoGeneracion): CuerpoArmado {
  const contrato = revisado(pedido);
  if (contrato === null) return Object.freeze({ ok: false, detalle: "PEDIDO_INVALIDO" });
  const contenido = vistaParaNube(contrato.vista);
  if (contenido === null) return Object.freeze({ ok: false, detalle: "VISTA_NO_CIEGA" });
  const schema = esquemaEstricto(contrato.esquemaSalida);
  if (schema === null) return Object.freeze({ ok: false, detalle: "ESQUEMA_NO_ADMITIDO" });
  const cuerpo: CuerpoNube = clonCongelado({
    model: MODELO_NUBE,
    max_tokens: MAX_TOKENS_NUBE,
    system: contrato.prompt.texto,
    messages: [{ role: "user", content: contenido }],
    thinking: { type: "adaptive" },
    output_config: { effort: ESFUERZO_NUBE, format: { type: "json_schema", schema } },
  });
  return Object.freeze({ ok: true, cuerpo, json: JSON.stringify(cuerpo), limiteMs: contrato.limiteMs });
}
