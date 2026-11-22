/**
 * Lo propio de la API de Ollama, puro (sin red): los cuerpos que se mandan y la lectura de lo que vuelve.
 * - `cuerpoGenerar`: el modelo recibe SOLO el texto del prompt versionado (`system`) y el JSON canónico de la vista
 *   ciega (`prompt`); `format` es el esquema del pedido; sin flujo, temperatura 0, semilla 42 y `keep_alive` corto. Ni
 *   el hash ni la versión del prompt, ni el límite.
 * - `cuerpoSmoke`: la generación mínima de la sonda, como el smoke de PI (sin `format` ni `system`, pocos tokens).
 * - `verificarModelo`: en `/api/tags`, exactamente una entrada con el nombre aprobado (en `name` o en `model`) y con el
 *   digest aprobado (64 hex, con o sin el prefijo «sha256:», comparado exacto).
 * - `leerGeneracion`: la respuesta de `/api/generate`, del mismo modelo y terminada; la salida es `response` y, si
 *   viene vacía, `thinking` (como PI: un modelo con modo de pensar puede dejar ahí el JSON). Se entrega tal cual.
 *
 * Los cuerpos se arman con el JSON canónico: el orden queda fijo. Hechos de la documentación de Ollama (api.md): el
 * digest de tags viene sin prefijo y `keep_alive` vale por omisión 5m; `thinking` en generate no está documentado.
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

export interface Generacion {
  /** La salida elegida (`response` o, si viene vacía, `thinking`), sin recortar. */
  readonly salida: string;
  readonly tokensEntrada: number | null;
  readonly tokensSalida: number | null;
  /** El modelo paró por el tope de tokens (`done_reason: "length"`): la salida puede estar incompleta. */
  readonly cortada: boolean;
}

export function cuerpoGenerar(modelo: string, pedido: PedidoGeneracion): string {
  return jsonCanonico({
    model: modelo,
    system: pedido.prompt.texto,
    prompt: jsonCanonico(pedido.vista),
    format: pedido.esquemaSalida,
    stream: false,
    options: OPCIONES_GENERACION,
    keep_alive: KEEP_ALIVE_LOCAL,
  });
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

export function leerGeneracion(datos: unknown, modelo: string): { readonly ok: true; readonly generacion: Generacion } | FalloLocal {
  if (!esObjetoPlano(datos)) return falloLocal("ERROR_PROVEEDOR", "CUERPO_INVALIDO");
  if (datos.model !== modelo) return falloLocal("ERROR_PROVEEDOR", "MODELO_DISTINTO");
  if (datos.done !== true) return falloLocal("ERROR_PROVEEDOR", "GENERACION_INCOMPLETA");
  const { response, thinking } = datos;
  const salida = conContenido(response) ? response : conContenido(thinking) ? thinking : null;
  if (salida === null) return falloLocal("ERROR_PROVEEDOR", "RESPUESTA_VACIA");
  return {
    ok: true,
    generacion: { salida, tokensEntrada: conteo(datos.prompt_eval_count), tokensSalida: conteo(datos.eval_count), cortada: datos.done_reason === "length" },
  };
}
