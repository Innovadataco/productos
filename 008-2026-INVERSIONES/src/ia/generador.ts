/**
 * El contrato de un generador (una puerta: «local», el Ollama del Mac, o «nube», la API de Claude). Lo implementan
 * los clientes; aquí no hay red. Un generador recibe SOLO el pedido: la vista ciega, el prompt versionado con su hash,
 * el esquema de salida y el límite de tiempo. Nunca el paquete completo.
 *
 * El pedido lo arma `armarPedido` desde el paquete completo: la vista la calcula `vistaCiega` (con su guarda), el
 * prompt y el esquema se cotejan contra los datos del paquete y el hash del prompt lo calcula el código. Así nadie
 * arma un pedido con una vista a mano, con datos en el prompt ni con un hash que no cuadre.
 */
import type { PaqueteCiego, PaqueteHechos, TipoResumen } from "./contrato";
import { esObjetoPlano, soloCampos, sonDatosPuros } from "./formas";
import { clonCongelado, jsonCanonico, sha256Hex } from "./hash";
import { ErrorVistaCiega, hayDatosDelPaqueteEn, vistaCiega } from "./vista-ciega";

export const PUERTAS = Object.freeze(["local", "nube"] as const);
export type Puerta = (typeof PUERTAS)[number];

/**
 * Lo que puede responder un generador (o el orquestador por esa puerta) cuando falla. Lista cerrada. PUERTA_APAGADA
 * la pone el orquestador si no hay generador registrado, y también puede devolverla un cliente que no está habilitado
 * (p. ej. la nube sin su llave).
 */
export const MOTIVOS_FALLO_GENERADOR = Object.freeze(["MODELO_NO_DISPONIBLE", "TIEMPO_AGOTADO", "TOPE_MENSUAL", "PUERTA_APAGADA", "ERROR_PROVEEDOR"] as const);
export type MotivoFalloGenerador = (typeof MOTIVOS_FALLO_GENERADOR)[number];

/**
 * Todos los motivos de fallo de una corrida (los que se registran). VISTA_NO_CIEGA lo pone solo `generarConPuertas`,
 * cuando la guarda rechaza el pedido: no se llamó a ningún generador. Un generador que lo devuelva es un error suyo.
 */
export const MOTIVOS_FALLO = Object.freeze([...MOTIVOS_FALLO_GENERADOR, "VISTA_NO_CIEGA"] as const);
export type MotivoFallo = (typeof MOTIVOS_FALLO)[number];

/**
 * El detalle de un fallo es un código, nunca datos ni mensajes del proveedor: mayúsculas y guion bajo, SIN dígitos.
 * Un cliente traduce, p. ej., un estado HTTP a un código propio («HTTP_LIMITE_DE_PEDIDOS», no «HTTP_429»); lo que no
 * cumpla el patrón lo reemplaza el orquestador por DETALLE_NO_VALIDO.
 */
export const PATRON_DETALLE = /^[A-Z]+(?:_[A-Z]+)*$/;
export const MAX_LARGO_DETALLE = 64;
/** «resumen-diario-v1»: minúsculas con guiones y la versión al final. */
export const PATRON_VERSION_PROMPT = /^[a-z]+(?:-[a-z]+)*-v[1-9][0-9]*$/;
export const LIMITE_MIN_MS = 1;
export const LIMITE_MAX_MS = 600_000;
export const MAX_LARGO_PROMPT = 32_768;
export const MAX_LARGO_ESQUEMA = 32_768;
export const MAX_SALIDA_CRUDA = 65_536;
/** Nombre y digest del modelo: ASCII visible, sin espacios. */
export const PATRON_MODELO = /^[\x21-\x7e]{1,128}$/;

export interface PromptVersionado {
  readonly texto: string;
  readonly version: string;
}

export interface PromptConHash extends PromptVersionado {
  /** sha256 en hexadecimal del texto: lo calcula `armarPedido`. */
  readonly hash: string;
}

/**
 * Un objeto JSON Schema (p. ej. `{ type: "object", … }`). Solo admite lo que admite el JSON canónico: números
 * ENTEROS (un `minimum: 0.5` o un `multipleOf: 0.01` dan ESQUEMA_INVALIDO). Ni el esquema ni el prompt pueden llevar
 * un nombre, un valor o una presentación del paquete (DATOS_EN_EL_PEDIDO).
 */
export type EsquemaSalida = Readonly<Record<string, unknown>>;

export interface PedidoGeneracion<T extends TipoResumen = TipoResumen> {
  readonly vista: PaqueteCiego<T>;
  readonly prompt: PromptConHash;
  readonly esquemaSalida: EsquemaSalida;
  readonly limiteMs: number;
}

export interface ExitoGeneracion {
  readonly ok: true;
  readonly puerta: Puerta;
  /**
   * La salida del modelo tal cual: la valida y la renderiza el validador, nunca se publica sin él. Tope:
   * MAX_SALIDA_CRUDA; el cliente debe cortar la lectura en ese tope, no después de leerla entera.
   */
  readonly salidaCruda: string;
  readonly modelo: string;
  readonly modeloDigest: string;
  /** Milisegundos, no negativo. Si el cliente la mide con fracción, el orquestador la redondea. */
  readonly latenciaMs: number;
  readonly tokensEntrada: number | null;
  readonly tokensSalida: number | null;
}

export interface FalloGeneracion {
  readonly ok: false;
  readonly puerta: Puerta;
  readonly motivo: MotivoFalloGenerador;
  /** Un código (PATRON_DETALLE), sin datos ni mensajes del proveedor. */
  readonly detalle: string;
}

export type ResultadoGeneracion = ExitoGeneracion | FalloGeneracion;

export interface Generador {
  readonly puerta: Puerta;
  /** `senal` se aborta cuando vence el límite del orquestador: el cliente debe cortar su pedido. */
  generar(pedido: PedidoGeneracion, senal: AbortSignal): Promise<ResultadoGeneracion>;
}

export const CODIGOS_ERROR_PEDIDO = Object.freeze(["CAMPO_DESCONOCIDO", "PROMPT_INVALIDO", "PROMPT_HASH_NO_COINCIDE", "ESQUEMA_INVALIDO", "LIMITE_INVALIDO"] as const);
export type CodigoErrorPedido = (typeof CODIGOS_ERROR_PEDIDO)[number];

/** Un pedido mal formado es un defecto del código (no del proveedor): lanza, sin repetir lo recibido. */
export class ErrorPedido extends Error {
  override readonly name = "ErrorPedido";
  constructor(readonly codigo: CodigoErrorPedido) {
    super(`Pedido de generación rechazado: ${codigo}.`);
  }
}

export interface EntradaPedido<T extends TipoResumen = TipoResumen> {
  readonly paquete: PaqueteHechos<T>;
  readonly prompt: PromptVersionado;
  readonly esquemaSalida: EsquemaSalida;
  readonly limiteMs: number;
}

function promptValido(prompt: unknown): prompt is PromptVersionado {
  if (!esObjetoPlano(prompt)) return false;
  const { texto, version } = prompt;
  return typeof texto === "string" && texto.length > 0 && texto.length <= MAX_LARGO_PROMPT && texto.isWellFormed()
    && typeof version === "string" && PATRON_VERSION_PROMPT.test(version);
}

const limiteValido = (limiteMs: unknown): limiteMs is number =>
  typeof limiteMs === "number" && Number.isInteger(limiteMs) && limiteMs >= LIMITE_MIN_MS && limiteMs <= LIMITE_MAX_MS;

const CAMPOS_PEDIDO: readonly string[] = Object.freeze(["vista", "prompt", "esquemaSalida", "limiteMs"]);
const CAMPOS_PROMPT: readonly string[] = Object.freeze(["texto", "version", "hash"]);

/**
 * El esquema copiado UNA sola vez (datos puros, sin Proxy ni getters, por el JSON canónico) y congelado; null si no es
 * un objeto JSON Schema de tipo object, si no tiene forma canónica o si pasa del tope.
 */
function copiaDelEsquema(esquema: unknown): EsquemaSalida | null {
  if (!sonDatosPuros(esquema) || !esObjetoPlano(esquema)) return null;
  let copia: EsquemaSalida;
  try {
    copia = clonCongelado(esquema);
  } catch {
    return null;
  }
  return copia.type === "object" && jsonCanonico(copia).length <= MAX_LARGO_ESQUEMA ? copia : null;
}

/**
 * Revisa la forma de un pedido (objetos planos de datos, sin Proxy ni campos de más, en el pedido ni en el prompt), el
 * prompt con su hash, el esquema y el límite. Lee cada campo UNA sola vez y devuelve una copia con solo los campos del
 * contrato, hecha de esas lecturas: lo revisado es lo que sigue. La vista la revisa la guarda, contra el paquete.
 */
export function revisarPedido(pedido: PedidoGeneracion): PedidoGeneracion {
  const crudo: unknown = pedido;
  if (!esObjetoPlano(crudo)) throw new ErrorPedido("PROMPT_INVALIDO");
  const { vista, prompt, esquemaSalida, limiteMs } = crudo;
  if (!esObjetoPlano(prompt)) throw new ErrorPedido("PROMPT_INVALIDO");
  if (!soloCampos(crudo, CAMPOS_PEDIDO) || !soloCampos(prompt, CAMPOS_PROMPT)) throw new ErrorPedido("CAMPO_DESCONOCIDO");
  const { texto, version, hash } = prompt;
  if (!promptValido({ texto, version })) throw new ErrorPedido("PROMPT_INVALIDO");
  if (hash !== sha256Hex(texto as string)) throw new ErrorPedido("PROMPT_HASH_NO_COINCIDE");
  const esquema = copiaDelEsquema(esquemaSalida);
  if (esquema === null) throw new ErrorPedido("ESQUEMA_INVALIDO");
  if (!limiteValido(limiteMs)) throw new ErrorPedido("LIMITE_INVALIDO");
  return { vista: vista as PaqueteCiego, prompt: { texto: texto as string, version: version as string, hash }, esquemaSalida: esquema, limiteMs };
}

/** El pedido para los generadores: la vista ciega del paquete, el prompt con su hash, el esquema y el límite. Congelado. */
export function armarPedido<T extends TipoResumen>(entrada: EntradaPedido<T>): PedidoGeneracion<T> {
  const { prompt, esquemaSalida, limiteMs } = entrada;
  if (!promptValido(prompt)) throw new ErrorPedido("PROMPT_INVALIDO");
  const esquema = copiaDelEsquema(esquemaSalida);
  if (esquema === null) throw new ErrorPedido("ESQUEMA_INVALIDO");
  if (!limiteValido(limiteMs)) throw new ErrorPedido("LIMITE_INVALIDO");
  const vista = vistaCiega(entrada.paquete);
  if ([prompt.texto, jsonCanonico(esquema)].some((texto) => hayDatosDelPaqueteEn(texto, entrada.paquete))) throw new ErrorVistaCiega(["DATOS_EN_EL_PEDIDO"]);
  const conHash: PromptConHash = Object.freeze({ texto: prompt.texto, version: prompt.version, hash: sha256Hex(prompt.texto) });
  return Object.freeze({ vista, prompt: conHash, esquemaSalida: esquema, limiteMs });
}
