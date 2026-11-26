/**
 * Datos INVENTADOS para las pruebas del cliente de la nube: llaves falsas (nunca con la forma de una llave real),
 * mensajes de la API con tokens no redondos, cuerpos de error con un mensaje «del proveedor» que no debe salir nunca,
 * y los pedidos armados con `construirPaquete` y `armarPedido` desde las entradas ficticias de E1a.
 */
import { armarPedido, type PedidoGeneracion } from "@/ia/generador";
import type { PaqueteHechos, TipoDiario } from "@/ia/contrato";
import { construirPaquete } from "@/ia/paquete";
import { ENTRADAS_FICTICIAS } from "../../apoyo/hechos.ficticio";
import { ESQUEMA_FICTICIO, LIMITE_FICTICIO_MS, PROMPT_FICTICIO } from "../../apoyo/pedido.ficticio";

export const LLAVE_FICTICIA = "llave-ficticia-nube-4613-37911-alfa";
export const OTRA_LLAVE_FICTICIA = "otra-llave-ficticia-1237-beta";
export const MENSAJE_DEL_PROVEEDOR = "FICTICIA-ALFA 4613.27 secreto del proveedor";
export const SALIDA_FICTICIA = '{"frases":[{"texto":"El valor de las acciones {H03} sube.","hechos":["H03"]}]}';

export interface PedidoFicticio {
  readonly paquete: PaqueteHechos;
  readonly pedido: PedidoGeneracion;
}

export function pedidoFicticio(tipo: TipoDiario = "DIARIO", limiteMs = LIMITE_FICTICIO_MS): PedidoFicticio {
  const paquete = construirPaquete(ENTRADAS_FICTICIAS[tipo]());
  return { paquete, pedido: armarPedido({ paquete, prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO, limiteMs }) };
}

/** Un `Message` de la API tal como lo devuelve el SDK (JSON), con tokens inventados: 4613 + 37 + 911 de entrada, 379 de salida. */
export function mensajeFicticio(cambios: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "msg_ficticio_alfa",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [
      { type: "thinking", thinking: "", signature: "firma-ficticia" },
      { type: "text", text: SALIDA_FICTICIA, citations: null },
    ],
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    container: null,
    diagnostics: null,
    usage: {
      input_tokens: 4613,
      output_tokens: 379,
      cache_creation_input_tokens: 37,
      cache_read_input_tokens: 911,
      cache_creation: null,
      inference_geo: null,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: "standard",
      speed: null,
    },
    ...cambios,
  };
}

/** El cuerpo de un error de la API, con un mensaje que no debe aparecer en ningún resultado. */
export function cuerpoErrorFicticio(tipo: string, codigoError?: string): Record<string, unknown> {
  return {
    type: "error",
    error: { type: tipo, message: MENSAJE_DEL_PROVEEDOR, ...(codigoError === undefined ? {} : { details: { error_code: codigoError } }) },
    request_id: "req_ficticio_beta",
  };
}

/** Un mes de 2027 y gastos no redondos. */
export const MES_FICTICIO = "2027-03";
export const OTRO_MES_FICTICIO = "2027-04";
export const GASTO_FICTICIO = Object.freeze({ mes: MES_FICTICIO, tokensEntrada: 37911, tokensSalida: 4613 });
