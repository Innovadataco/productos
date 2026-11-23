import "server-only";
/**
 * El cuerpo del pedido a la API de mensajes de Claude, armado SOLO con el pedido de generación (nunca con el paquete):
 * - `system`: el texto exacto del prompt versionado (su hash lo calculó `armarPedido`); el cliente no agrega texto;
 * - el único mensaje: el JSON canónico de la vista ciega, revisado aquí otra vez antes de salir a internet;
 * - el modelo de la configuración de la IA (E8: `claude-opus-5-5` por omisión; sonnet o haiku solo si Jelk los elige,
 *   nunca se baja por costo), sin `fallbacks` a otro modelo;
 * - pensamiento adaptativo (en Opus 5.5 no se puede apagar: `disabled` y `budget_tokens` dan 400) con esfuerzo bajo:
 *   la documentación de la skill claude-api recomienda `low` para tareas simples y cuando importan la latencia y el
 *   costo; aquí el modelo solo redacta de cuatro a seis frases citando ids, sin cálculo. Se mide en la evaluación E7;
 * - `max_tokens` con holgura: el pensamiento cuenta dentro de `max_tokens` y una salida cortada se paga igual;
 * - salida estructurada (`output_config.format`) con el esquema del pedido pasado a la forma estricta de la API por el
 *   transformador del SDK (`additionalProperties: false` en todo objeto; lo que la API no impone, como `maxItems`, va a
 *   la descripción y lo valida el validador al leer);
 * - capacidad y velocidad estándar explícitas (`service_tier: "standard_only"`; `speed: "standard"` solo en opus, el
 *   único de la lista con modo rápido según la skill; en sonnet y haiku no se manda, POR VERIFICAR que la API lo
 *   acepte): el tope modela el precio estándar; la región de inferencia queda la del espacio de trabajo (la revisa Jelk);
 * - sin `temperature`, `top_p` ni `top_k` (400 en Opus 5.5 y en la versión de API que manda el SDK).
 *
 * Nunca lanza: un pedido que no debe salir devuelve su código.
 */
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";
import { entradaDeCatalogo } from "../catalogo";
import { CALIDADES, CAMPOS_HECHO_CIEGO, CAMPOS_PAQUETE_CIEGO, CERCANIAS, DIRECCIONES, FRESCURAS, TIPOS_RESUMEN, esIdHecho, type TipoResumen } from "../contrato";
import { esDe, esObjetoPlano, soloCampos, sonDatosPuros } from "../formas";
import { revisarPedido, type PedidoGeneracion } from "../generador";
import { clonCongelado, jsonCanonico } from "../hash";

/**
 * Los modelos de la nube que Jelk puede elegir (E8), lista cerrada. Sus precios están en `tope.ts` (TARIFAS_NUBE).
 * Agregar uno es un cambio de código revisado (y de la CHECK de `config_ia`).
 */
export const MODELOS_NUBE = Object.freeze(["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"] as const);
export type ModeloNube = (typeof MODELOS_NUBE)[number];
/** El modelo por omisión: opus (no se baja por costo sin la elección de Jelk). */
export const MODELO_NUBE: ModeloNube = "claude-opus-5-5";
export const MAX_TOKENS_NUBE = 8192;
/** Esfuerzos permitidos: bajo y medio (válidos en los tres modelos según la skill claude-api). */
export const ESFUERZOS_NUBE = Object.freeze(["low", "medium"] as const);
export type EsfuerzoNube = (typeof ESFUERZOS_NUBE)[number];
export const ESFUERZO_NUBE: EsfuerzoNube = "low";

/** El modelo y el esfuerzo de un pedido (de la configuración vigente de la IA). */
export interface AjustesNube {
  readonly modelo: ModeloNube;
  readonly esfuerzo: EsfuerzoNube;
}

export const AJUSTES_NUBE_POR_OMISION: AjustesNube = Object.freeze({ modelo: MODELO_NUBE, esfuerzo: ESFUERZO_NUBE });
/** El único modelo de la lista con modo rápido: solo a él se le pide la velocidad estándar explícita. */
const CON_MODO_RAPIDO: readonly ModeloNube[] = Object.freeze(["claude-opus-5-5"]);
const CAMPOS_AJUSTES: readonly string[] = Object.freeze(["modelo", "esfuerzo"]);

/** Los ajustes revisados (objeto plano con solo esos dos campos de sus listas), o null. */
export function revisarAjustesNube(ajustes: unknown): AjustesNube | null {
  if (!esObjetoPlano(ajustes) || !soloCampos(ajustes, CAMPOS_AJUSTES)) return null;
  const { modelo, esfuerzo } = ajustes;
  return esDe(MODELOS_NUBE, modelo) && esDe(ESFUERZOS_NUBE, esfuerzo) ? Object.freeze({ modelo, esfuerzo }) : null;
}

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

export type DetalleCuerpoNoArmado = "PEDIDO_INVALIDO" | "VISTA_NO_CIEGA" | "ESQUEMA_NO_ADMITIDO" | "AJUSTES_INVALIDOS";

export type CuerpoArmado =
  /** `json` es exactamente `JSON.stringify(cuerpo)`, lo que el SDK manda por el cable (con él se mide la cota). */
  | { readonly ok: true; readonly cuerpo: CuerpoNube; readonly json: string; readonly limiteMs: number }
  | { readonly ok: false; readonly detalle: DetalleCuerpoNoArmado };

/** Los ids son la única cifra permitida, y solo como valor completo de un campo («"H07"»). */
const ID_COMO_TEXTO = /"H[0-9]{2}"/g;
const CUALQUIER_DIGITO = /\p{N}/u;
const esId = (valor: unknown): boolean => typeof valor === "string" && esIdHecho(valor);

/**
 * Un hecho ciego con cada campo dentro de su lista cerrada: el id, el sujeto y la especie (opcionales) son ids, la clave es del
 * catálogo del tipo y la etiqueta es la del catálogo para esa clave, las marcas son de sus listas y `obligatorio` es
 * booleano. Así ningún texto libre (un nombre, un valor escrito en letras) sale en un campo de texto.
 */
function hechoCiegoValido(tipo: TipoResumen, hecho: unknown): boolean {
  if (!esObjetoPlano(hecho) || !soloCampos(hecho, CAMPOS_HECHO_CIEGO)) return false;
  const { id, clave, etiqueta, sujeto, especie, direccion, cercania, frescura, calidad, obligatorio } = hecho;
  const catalogo = typeof clave === "string" ? entradaDeCatalogo(tipo, clave) : null;
  return esId(id) && catalogo !== null && etiqueta === catalogo.etiqueta && (!Object.hasOwn(hecho, "sujeto") || esId(sujeto))
    && (!Object.hasOwn(hecho, "especie") || esId(especie))
    && esDe(DIRECCIONES, direccion) && esDe(CERCANIAS, cercania) && esDe(FRESCURAS, frescura) && esDe(CALIDADES, calidad)
    && typeof obligatorio === "boolean";
}

/**
 * El JSON canónico de la vista (lo que se envía), o null si no tiene la forma de una vista ciega: solo el tipo y los
 * hechos con los campos ciegos en sus listas cerradas, datos puros y ningún dígito fuera de los ids. Se serializa una
 * sola vez: lo revisado es lo que sale.
 */
export function vistaParaNube(vista: unknown): string | null {
  if (!sonDatosPuros(vista) || !esObjetoPlano(vista) || !soloCampos(vista, CAMPOS_PAQUETE_CIEGO)) return null;
  const json = canonicoONulo(vista);
  // Primero, el detector independiente: ningún dígito fuera de los ids; después, las listas cerradas.
  if (json === null || CUALQUIER_DIGITO.test(json.replace(ID_COMO_TEXTO, '""'))) return null;
  const { tipo, hechos } = vista;
  return esDe(TIPOS_RESUMEN, tipo) && Array.isArray(hechos) && hechos.every((hecho) => hechoCiegoValido(tipo, hecho)) ? json : null;
}

/** El JSON canónico, o null si el valor no tiene forma canónica (p. ej. un número con decimales). */
function canonicoONulo(valor: unknown): string | null {
  try {
    return jsonCanonico(valor);
  } catch {
    return null;
  }
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

/** El cuerpo congelado del pedido, o el código de por qué no sale. Sin ajustes, los de omisión (opus, esfuerzo bajo). */
export function armarCuerpoNube(pedido: PedidoGeneracion, ajustes: AjustesNube = AJUSTES_NUBE_POR_OMISION): CuerpoArmado {
  const elegidos = revisarAjustesNube(ajustes);
  if (elegidos === null) return Object.freeze({ ok: false, detalle: "AJUSTES_INVALIDOS" });
  const contrato = revisado(pedido);
  if (contrato === null) return Object.freeze({ ok: false, detalle: "PEDIDO_INVALIDO" });
  const contenido = vistaParaNube(contrato.vista);
  if (contenido === null) return Object.freeze({ ok: false, detalle: "VISTA_NO_CIEGA" });
  const schema = esquemaEstricto(contrato.esquemaSalida);
  if (schema === null) return Object.freeze({ ok: false, detalle: "ESQUEMA_NO_ADMITIDO" });
  const velocidad = CON_MODO_RAPIDO.includes(elegidos.modelo) ? { speed: "standard" as const } : {};
  const cuerpo: CuerpoNube = clonCongelado({
    model: elegidos.modelo,
    max_tokens: MAX_TOKENS_NUBE,
    system: contrato.prompt.texto,
    messages: [{ role: "user", content: contenido }],
    thinking: { type: "adaptive" },
    output_config: { effort: elegidos.esfuerzo, format: { type: "json_schema", schema } },
    service_tier: "standard_only",
    ...velocidad,
  });
  return Object.freeze({ ok: true, cuerpo, json: JSON.stringify(cuerpo), limiteMs: contrato.limiteMs });
}
