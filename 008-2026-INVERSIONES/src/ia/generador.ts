/**
 * El contrato de un generador (una puerta: «local», el Ollama del Mac, o «nube», la API de Claude). Lo implementan
 * los clientes; aquí no hay red. Un generador recibe SOLO el pedido: la vista ciega, el prompt versionado con su hash,
 * el esquema de salida y el límite de tiempo. Nunca el paquete completo.
 *
 * El pedido lo arma `armarPedido` desde el paquete completo: la vista la calcula `vistaCiega` (con su guarda) y el
 * hash del prompt lo calcula el código. Así nadie arma un pedido con una vista a mano ni con un hash que no cuadre.
 */
/* Esqueleto (rojo). */
import type { PaqueteCiego, PaqueteHechos, TipoResumen } from "./contrato";

export const PUERTAS = Object.freeze(["local", "nube"] as const);
export type Puerta = (typeof PUERTAS)[number];

/** Lista cerrada. VISTA_NO_CIEGA la pone `generarConPuertas` cuando la guarda rechaza la vista: no se llamó a nadie. */
export const MOTIVOS_FALLO = Object.freeze(["MODELO_NO_DISPONIBLE", "TIEMPO_AGOTADO", "TOPE_MENSUAL", "PUERTA_APAGADA", "ERROR_PROVEEDOR", "VISTA_NO_CIEGA"] as const);
export type MotivoFallo = (typeof MOTIVOS_FALLO)[number];

/** El detalle de un fallo es un código, nunca datos: mayúsculas y guion bajo, sin dígitos. */
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

/** Un objeto JSON Schema (p. ej. `{ type: "object", … }`). Solo admite lo que admite el JSON canónico. */
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
  /** La salida del modelo tal cual: la valida y la renderiza el validador, nunca se publica sin él. */
  readonly salidaCruda: string;
  readonly modelo: string;
  readonly modeloDigest: string;
  readonly latenciaMs: number;
  readonly tokensEntrada: number | null;
  readonly tokensSalida: number | null;
}

export interface FalloGeneracion {
  readonly ok: false;
  readonly puerta: Puerta;
  readonly motivo: MotivoFallo;
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

export function revisarPedido(_pedido: PedidoGeneracion): PedidoGeneracion { throw new Error("SIN_IMPLEMENTAR"); }
export function armarPedido<T extends TipoResumen>(_entrada: EntradaPedido<T>): PedidoGeneracion<T> { throw new Error("SIN_IMPLEMENTAR"); }
