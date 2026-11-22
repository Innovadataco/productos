import "server-only";
/**
 * Lo que vuelve de la API, traducido al contrato del generador. Nada del proveedor pasa tal cual: ni el mensaje de un
 * error, ni sus cabeceras, ni su cuerpo; solo un motivo de la lista cerrada y un código como detalle.
 *
 * Una respuesta 200 con `usage` válido se factura, así que vuelve SIEMPRE como éxito con sus tokens, para que el
 * registro la cuente en el tope (el contrato no lleva tokens en un fallo). Su salida es el texto del modelo solo si
 * terminó bien: `end_turn`, únicamente bloques de texto o de pensamiento, texto bien formado y dentro de
 * `MAX_SALIDA_CRUDA`. Si no (un rechazo del modelo, `max_tokens`, una herramienta…), la salida va vacía y el validador
 * la rechaza. Sin `usage` válido no hay qué contar: ERROR_PROVEEDOR · RESPUESTA_INVALIDA (y el generador reserva).
 */
import { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from "@anthropic-ai/sdk";
import { esObjetoPlano, type Registro } from "../formas";
import { MAX_SALIDA_CRUDA, PATRON_MODELO, type ExitoGeneracion, type FalloGeneracion, type MotivoFalloGenerador } from "../generador";
import { CODIGOS_APAGADO_NUBE } from "./config";
import { MODELO_NUBE, type ModeloNube } from "./peticion";
import { ErrorTransporteNube } from "./transporte";

/** Todos los detalles que puede dar la puerta nube (lista cerrada; cumplen `PATRON_DETALLE`). */
export const DETALLES_NUBE = Object.freeze([
  ...CODIGOS_APAGADO_NUBE,
  "ABORTADO", "TIEMPO_DEL_CLIENTE", "TIEMPO_DEL_PROVEEDOR",
  "SIN_CONEXION", "MODELO_NO_ENCONTRADO", "LIMITE_DE_PEDIDOS", "SERVICIO_NO_DISPONIBLE", "SOBRECARGA",
  "TOPE_DEL_MES", "GASTO_NO_VERIFICABLE", "LIMITE_DE_GASTO_DEL_PROVEEDOR",
  "PEDIDO_INVALIDO", "VISTA_NO_CIEGA", "ESQUEMA_NO_ADMITIDO", "PEDIDO_RECHAZADO", "NO_AUTORIZADO", "PAGO_REQUERIDO", "PROHIBIDO",
  "PEDIDO_DEMASIADO_GRANDE", "ERROR_DEL_SERVIDOR", "ERROR_DESCONOCIDO", "RESPUESTA_INVALIDA", "RESPUESTA_DEMASIADO_GRANDE",
  "DESTINO_NO_PERMITIDO", "EXCEPCION_INTERNA",
] as const);
export type DetalleNube = (typeof DETALLES_NUBE)[number];

export const falloNube = (motivo: MotivoFalloGenerador, detalle: DetalleNube): FalloGeneracion => Object.freeze({ ok: false, puerta: "nube", motivo, detalle });

const BLOQUES_DE_PENSAMIENTO: readonly string[] = Object.freeze(["thinking", "redacted_thinking"]);
const esConteo = (valor: unknown): valor is number => typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0;
const esConteoOpcional = (valor: unknown): valor is number | null | undefined => valor === null || valor === undefined || esConteo(valor);

/** Los tokens de `usage`: la entrada suma lo leído y lo escrito en caché (cuenta de más, nunca de menos). */
function tokensDe(usage: unknown): { readonly entrada: number; readonly salida: number } | null {
  if (!esObjetoPlano(usage)) return null;
  const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } = usage;
  if (!esConteo(input_tokens) || !esConteo(output_tokens) || !esConteoOpcional(cache_creation_input_tokens) || !esConteoOpcional(cache_read_input_tokens)) return null;
  const entrada = input_tokens + (cache_creation_input_tokens ?? 0) + (cache_read_input_tokens ?? 0);
  return Number.isSafeInteger(entrada) ? { entrada, salida: output_tokens } : null;
}

/** El texto del modelo, o "" si la respuesta no terminó bien (se paga, pero no sirve). */
function salidaDe(mensaje: Registro): string {
  const { stop_reason, content } = mensaje;
  if (stop_reason !== "end_turn" || !Array.isArray(content)) return "";
  const partes: string[] = [];
  for (const bloque of content as readonly unknown[]) {
    if (!esObjetoPlano(bloque)) return "";
    if (BLOQUES_DE_PENSAMIENTO.includes(bloque.type as string)) continue;
    if (bloque.type !== "text" || typeof bloque.text !== "string") return "";
    partes.push(bloque.text);
  }
  const texto = partes.join("");
  return texto.length <= MAX_SALIDA_CRUDA && texto.isWellFormed() ? texto : "";
}

/** Un éxito de la nube: siempre con los tokens de `usage`. */
export interface ExitoNube extends ExitoGeneracion {
  readonly tokensEntrada: number;
  readonly tokensSalida: number;
}

/**
 * Una respuesta 200 del SDK (lo que resolvió `messages.create`), con la latencia medida por el generador. `modelo` es el
 * pedido (E8: el de la configuración; por omisión, opus); el digest es el `model` que devolvió la API.
 */
export function leerRespuesta(crudo: unknown, latenciaMs: number, modelo: ModeloNube = MODELO_NUBE): ExitoNube | FalloGeneracion {
  if (!esObjetoPlano(crudo) || crudo.type !== "message") return falloNube("ERROR_PROVEEDOR", "RESPUESTA_INVALIDA");
  const { model } = crudo;
  const tokens = tokensDe(crudo.usage);
  if (typeof model !== "string" || !PATRON_MODELO.test(model) || tokens === null) return falloNube("ERROR_PROVEEDOR", "RESPUESTA_INVALIDA");
  return Object.freeze({
    ok: true,
    puerta: "nube",
    salidaCruda: salidaDe(crudo),
    modelo,
    modeloDigest: model,
    latenciaMs: Number.isFinite(latenciaMs) && latenciaMs > 0 ? latenciaMs : 0,
    tokensEntrada: tokens.entrada,
    tokensSalida: tokens.salida,
  });
}

const CODIGO_LIMITE_DE_GASTO = "enforced_spend_limit_reached";

/** Por estado HTTP: 4xx del pedido o de la cuenta → ERROR_PROVEEDOR; no disponible por un rato → MODELO_NO_DISPONIBLE. */
const POR_ESTADO: ReadonlyMap<number, readonly [MotivoFalloGenerador, DetalleNube]> = new Map([
  [400, ["ERROR_PROVEEDOR", "PEDIDO_RECHAZADO"]],
  [401, ["ERROR_PROVEEDOR", "NO_AUTORIZADO"]],
  [402, ["ERROR_PROVEEDOR", "PAGO_REQUERIDO"]],
  [403, ["ERROR_PROVEEDOR", "PROHIBIDO"]],
  [404, ["MODELO_NO_DISPONIBLE", "MODELO_NO_ENCONTRADO"]],
  [408, ["TIEMPO_AGOTADO", "TIEMPO_DEL_PROVEEDOR"]],
  [413, ["ERROR_PROVEEDOR", "PEDIDO_DEMASIADO_GRANDE"]],
  [422, ["ERROR_PROVEEDOR", "PEDIDO_RECHAZADO"]],
  [429, ["MODELO_NO_DISPONIBLE", "LIMITE_DE_PEDIDOS"]],
  [503, ["MODELO_NO_DISPONIBLE", "SERVICIO_NO_DISPONIBLE"]],
  [504, ["TIEMPO_AGOTADO", "TIEMPO_DEL_PROVEEDOR"]],
  [529, ["MODELO_NO_DISPONIBLE", "SOBRECARGA"]],
]);

function porEstado(error: APIError & { readonly status: number }): FalloGeneracion {
  if (error.errorCode === CODIGO_LIMITE_DE_GASTO) return falloNube("TOPE_MENSUAL", "LIMITE_DE_GASTO_DEL_PROVEEDOR");
  const fila = POR_ESTADO.get(error.status);
  if (fila !== undefined) return falloNube(fila[0], fila[1]);
  return error.status >= 500 ? falloNube("ERROR_PROVEEDOR", "ERROR_DEL_SERVIDOR") : falloNube("ERROR_PROVEEDOR", "ERROR_DESCONOCIDO");
}

const tieneEstado = (error: APIError): error is APIError & { readonly status: number } => typeof error.status === "number";

/**
 * Un error del SDK (o cualquier cosa lanzada) como fallo de la puerta nube. Si la señal del orquestador ya se abortó,
 * gana el tiempo: TIEMPO_AGOTADO · ABORTADO. Nunca usa el mensaje, el cuerpo ni las cabeceras del error; de la causa
 * solo mira si es del transporte propio, para tomar su código.
 */
export function traducirError(error: unknown, senal: AbortSignal): FalloGeneracion {
  if (senal.aborted || error instanceof APIUserAbortError) return falloNube("TIEMPO_AGOTADO", "ABORTADO");
  if (error instanceof APIConnectionTimeoutError) return falloNube("TIEMPO_AGOTADO", "TIEMPO_DEL_CLIENTE");
  if (error instanceof APIConnectionError) {
    const causa: unknown = error.cause;
    return causa instanceof ErrorTransporteNube ? falloNube("ERROR_PROVEEDOR", causa.codigo) : falloNube("MODELO_NO_DISPONIBLE", "SIN_CONEXION");
  }
  if (error instanceof APIError && tieneEstado(error)) return porEstado(error);
  return falloNube("ERROR_PROVEEDOR", "EXCEPCION_INTERNA");
}

/** Un 408 o un 5xx pudo llegar después de que el modelo trabajó (no está verificado que no se cobre). */
const ESTADO_QUE_PUDO_COBRARSE = (estado: number): boolean => estado === 408 || estado >= 500;

/**
 * ¿Pudo cobrarse la llamada sin que se sepa cuánto? Sí, por las dudas, si el pedido pudo llegar al modelo y no volvió
 * un `usage`: un aborto, un corte de tiempo o de conexión, una respuesta demasiado grande, un 408 o un 5xx (incluidos
 * la sobrecarga y el servicio no disponible), o un error desconocido. No, si el servidor rechazó el pedido con otro 4xx
 * (validación, credencial, permiso, límite de pedidos) o si el transporte no lo dejó salir.
 */
export function hayPosibleCobro(error: unknown): boolean {
  if (error instanceof APIConnectionError) {
    const causa: unknown = error.cause;
    return !(causa instanceof ErrorTransporteNube && causa.codigo === "DESTINO_NO_PERMITIDO");
  }
  if (error instanceof APIUserAbortError) return true;
  return error instanceof APIError && tieneEstado(error) ? ESTADO_QUE_PUDO_COBRARSE(error.status) : true;
}
