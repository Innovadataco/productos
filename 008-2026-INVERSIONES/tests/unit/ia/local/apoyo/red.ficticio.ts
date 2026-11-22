/**
 * Red, modelos y pedidos INVENTADOS para las pruebas de la puerta local. La IP de la tailnet se arma al correr (el
 * cruce de literales de la Fábrica marca cualquier IPv4 escrita); el puerto no es redondo; los digests son sha256 de
 * frases inventadas. Nada sale de la gestión ni de los documentos de PI. Los paquetes salen de `construirPaquete` y
 * los pedidos de `armarPedido`, nunca a mano.
 */
import type { PaqueteHechos } from "@/ia/contrato";
import { armarPedido, type PedidoGeneracion } from "@/ia/generador";
import { sha256Hex } from "@/ia/hash";
import type { ModeloAprobado } from "@/ia/local/modelos";
import { construirPaquete } from "@/ia/paquete";
import { entradaDiario } from "../../apoyo/hechos.ficticio";
import { ESQUEMA_FICTICIO, LIMITE_FICTICIO_MS, PROMPT_FICTICIO } from "../../apoyo/pedido.ficticio";

export const ip = (...octetos: readonly number[]): string => octetos.join(".");
export const IP_FICTICIA = ip(100, 73, 41, 157);
export const PUERTO_FICTICIO = 47213;
export const ORIGEN_FICTICIO = `http://${IP_FICTICIA}:${PUERTO_FICTICIO}`;
export const URL_TAGS = `${ORIGEN_FICTICIO}/api/tags`;
export const URL_GENERAR = `${ORIGEN_FICTICIO}/api/generate`;

export const MODELO_LOCAL_FICTICIO = "ficticio-local:7b";
export const MODELO_PENDIENTE_FICTICIO = "ficticio-pendiente:3b";
export const DIGEST_LOCAL_FICTICIO = sha256Hex("digest inventado del modelo local ficticio");
export const OTRO_DIGEST_FICTICIO = sha256Hex("otro digest inventado, de un modelo cambiado");

/** Lista de aprobados para las pruebas con `vi.mock("@/ia/local/modelos")`: uno con digest y uno pendiente. */
export const MODELOS_FICTICIOS: readonly ModeloAprobado[] = Object.freeze([
  Object.freeze({ nombre: MODELO_LOCAL_FICTICIO, digest: DIGEST_LOCAL_FICTICIO }),
  Object.freeze({ nombre: MODELO_PENDIENTE_FICTICIO, digest: null }),
]);

export function modeloAprobadoFicticio(nombre: unknown): ModeloAprobado | null {
  return MODELOS_FICTICIOS.find((modelo) => modelo.nombre === nombre) ?? null;
}

export const CONFIG_FICTICIA = Object.freeze({ destino: ORIGEN_FICTICIO, modelo: MODELO_LOCAL_FICTICIO });

export function pedidoFicticio(limiteMs = LIMITE_FICTICIO_MS): { readonly paquete: PaqueteHechos; readonly pedido: PedidoGeneracion } {
  const paquete = construirPaquete(entradaDiario());
  return { paquete, pedido: armarPedido({ paquete, prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO, limiteMs }) };
}

/** Una salida del modelo inventada: cita los hechos y no escribe cifras. */
export const SALIDA_FICTICIA = JSON.stringify({ frases: [{ texto: "El valor de las acciones subió frente al cierre anterior {H03}.", hechos: ["H03"] }] });
