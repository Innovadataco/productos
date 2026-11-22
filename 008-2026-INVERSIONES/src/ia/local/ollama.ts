/**
 * Lo propio de la API de Ollama, puro (sin red): los cuerpos que se mandan y la lectura de lo que vuelve.
 * - `cuerpoGenerar`: el modelo recibe SOLO el texto del prompt versionado (`system`) y el JSON canónico de la vista
 *   ciega (`prompt`); `format` es el esquema del pedido; sin flujo, temperatura 0, semilla 42 y `keep_alive` corto. Ni
 *   el hash ni la versión del prompt, ni el límite.
 * - `cuerpoSmoke`: la generación mínima de la sonda, como el smoke de PI (sin `format` ni `system`, pocos tokens).
 * - `verificarModelo`: en `/api/tags`, exactamente una entrada con el nombre aprobado (en `name` o en `model`) y con el
 *   digest aprobado (64 hex, con o sin el prefijo «sha256:», comparado exacto).
 * - `leerGeneracion`: la respuesta de `/api/generate` (con `model` en texto), del mismo modelo y terminada; la salida
 *   es `response` y, si viene vacía o falta, `thinking` (como PI: un modelo con modo de pensar puede dejar ahí el JSON),
 *   con su origen marcado. Un `response` presente que no es texto es un cuerpo inválido. Se entrega tal cual. La
 *   finalización (`done_reason`) se informa: «stop» o ausente es completa, «length» es por largo, otra cosa es otra;
 *   quien llama decide.
 *
 * Los cuerpos se arman con el JSON canónico: el orden queda fijo. Hechos de la documentación de Ollama (api.md): el
 * digest de tags viene sin prefijo y `keep_alive` vale por omisión 5m; `thinking` en generate no está documentado.
 *
 * No se fija `num_ctx`: un valor distinto del que tiene cargado el modelo de PI podría hacer que Ollama lo recargue
 * (sin verificar). Riesgo abierto: si la vista pasa del contexto por omisión del modelo, Ollama puede recortar el
 * prompt sin avisar; se mide en E7 (`prompt_eval_count` frente al contexto del modelo en el Mac).
 */
import type { PedidoGeneracion } from "../generador";
import { esObjetoPlano } from "../formas";
import { jsonCanonico } from "../hash";
import { falloLocal, type FalloLocal } from "./errores";

/**
 * Corto: 008 no retiene el modelo. Riesgo abierto (sin verificar): el modelo es el mismo que PI mantiene caliente, y si
 * Ollama aplica a todos el `keep_alive` del último pedido, uno corto también lo descarga antes para PI. Se mide en E7.
 */
export const KEEP_ALIVE_LOCAL = "30s";
export const OPCIONES_GENERACION = Object.freeze({ temperature: 0, seed: 42 });
export const OPCIONES_SMOKE = Object.freeze({ temperature: 0, seed: 42, num_predict: 5 });
export const PROMPT_SMOKE = "Responda solo: ok";
/** Tope de entradas de `/api/tags` que se revisan. */
export const MAX_MODELOS_TAGS = 1024;

const DIGEST_TAGS = /^(?:sha256:)?([0-9a-f]{64})$/;

export interface Aprobado {
  readonly nombre: string;
  readonly digest: string;
}

export type OrigenSalida = "RESPONSE" | "THINKING";
/** COMPLETA: «stop» o sin `done_reason`; POR_LARGO: «length» (la salida puede estar incompleta); OTRA: lo demás. */
export type Finalizacion = "COMPLETA" | "POR_LARGO" | "OTRA";

export interface Generacion {
  /** La salida elegida (`response` o, si viene vacía, `thinking`), sin recortar. */
  readonly salida: string;
  readonly origen: OrigenSalida;
  readonly tokensEntrada: number | null;
  readonly tokensSalida: number | null;
  readonly finalizacion: Finalizacion;
}

/** Marcador del valor de `options` mientras se arma el JSON canónico (que solo admite enteros). */
const MARCA_OPCIONES = "__OPCIONES_DE_LA_GENERACION__";
const CENTESIMAS = 100;

/** La temperatura en centésimas (entero de 0 a 100) como número JSON: 0, 0.05, 0.37, 1. */
function temperaturaJson(centesimas: number): string {
  const enteros = Math.trunc(centesimas / CENTESIMAS);
  const resto = centesimas % CENTESIMAS;
  if (resto === 0) return String(enteros);
  return `${enteros}.${String(resto).padStart(2, "0").replace(/0$/, "")}`;
}

/**
 * El cuerpo de /api/generate. E8: la temperatura de la configuración (en centésimas, de 0 a 100; sin ella, 0, como
 * antes); la semilla queda fija. El JSON canónico no admite decimales: `options` se arma aparte, solo con enteros, y se
 * pone en el lugar de su marcador (que solo puede aparecer como el valor de `options`: dentro de cualquier texto, las
 * comillas van escapadas). Con 0, el cuerpo es exactamente el de siempre.
 */
export function cuerpoGenerar(modelo: string, pedido: PedidoGeneracion, temperaturaCentesimas = 0): string {
  const base = jsonCanonico({
    model: modelo,
    system: pedido.prompt.texto,
    prompt: jsonCanonico(pedido.vista),
    format: pedido.esquemaSalida,
    stream: false,
    options: MARCA_OPCIONES,
    keep_alive: KEEP_ALIVE_LOCAL,
  });
  const opciones = `{"seed":${OPCIONES_GENERACION.seed},"temperature":${temperaturaJson(temperaturaCentesimas)}}`;
  return base.replace(`"options":"${MARCA_OPCIONES}"`, `"options":${opciones}`);
}

export function cuerpoSmoke(modelo: string): string {
  return jsonCanonico({ model: modelo, prompt: PROMPT_SMOKE, stream: false, options: OPCIONES_SMOKE, keep_alive: KEEP_ALIVE_LOCAL });
}

export function verificarModelo(datos: unknown, aprobado: Aprobado): { readonly ok: true } | FalloLocal {
  if (!esObjetoPlano(datos) || !Array.isArray(datos.models) || datos.models.length > MAX_MODELOS_TAGS) return falloLocal("ERROR_PROVEEDOR", "CUERPO_INVALIDO");
  const entradas = (datos.models as readonly unknown[]).filter((m) => esObjetoPlano(m) && (m.name === aprobado.nombre || m.model === aprobado.nombre));
  if (entradas.length === 0) return falloLocal("MODELO_NO_DISPONIBLE", "MODELO_NO_ENCONTRADO");
  if (entradas.length > 1) return falloLocal("MODELO_NO_DISPONIBLE", "MODELO_AMBIGUO");
  const { digest } = entradas[0] as { readonly digest?: unknown };
  const hex = typeof digest === "string" ? DIGEST_TAGS.exec(digest)?.[1] : undefined;
  return hex === aprobado.digest ? { ok: true } : falloLocal("MODELO_NO_DISPONIBLE", "DIGEST_NO_COINCIDE");
}

const conContenido = (texto: unknown): texto is string => typeof texto === "string" && texto.trim() !== "";
const conteo = (valor: unknown): number | null => (typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0 ? valor : null);

function finalizacionDe(doneReason: unknown): Finalizacion {
  if (doneReason === undefined || doneReason === "stop") return "COMPLETA";
  return doneReason === "length" ? "POR_LARGO" : "OTRA";
}

export function leerGeneracion(datos: unknown, modelo: string): { readonly ok: true; readonly generacion: Generacion } | FalloLocal {
  if (!esObjetoPlano(datos) || typeof datos.model !== "string") return falloLocal("ERROR_PROVEEDOR", "CUERPO_INVALIDO");
  if (datos.model !== modelo) return falloLocal("ERROR_PROVEEDOR", "MODELO_DISTINTO");
  if (datos.done !== true) return falloLocal("ERROR_PROVEEDOR", "GENERACION_INCOMPLETA");
  const { response, thinking } = datos;
  if (response !== undefined && typeof response !== "string") return falloLocal("ERROR_PROVEEDOR", "CUERPO_INVALIDO");
  const elegida = conContenido(response) ? { salida: response, origen: "RESPONSE" as const } : conContenido(thinking) ? { salida: thinking, origen: "THINKING" as const } : null;
  if (elegida === null) return falloLocal("ERROR_PROVEEDOR", "RESPUESTA_VACIA");
  return {
    ok: true,
    generacion: { ...elegida, tokensEntrada: conteo(datos.prompt_eval_count), tokensSalida: conteo(datos.eval_count), finalizacion: finalizacionDe(datos.done_reason) },
  };
}
