/**
 * Generador falso, sin red: responde, falla, lanza, tarda o se cuelga según se le configure. Lo usan las pruebas de
 * las puertas, del validador y de los clientes. Guarda cada pedido que recibe (`llamadas()`) para contar llamadas y
 * revisar qué le llegó. No es para producción: ningún punto de entrada de la app debe importarlo.
 */
import type { Generador, MotivoFallo, PedidoGeneracion, Puerta, ResultadoGeneracion } from "./generador";

export const MODELO_FICTICIO = "modelo-ficticio";
export const DIGEST_FICTICIO = "digest-ficticio";

export type ConductaInmediata =
  | {
    readonly tipo: "RESPONDER";
    readonly salidaCruda: string;
    readonly modelo?: string;
    readonly modeloDigest?: string;
    readonly latenciaMs?: number;
    readonly tokensEntrada?: number | null;
    readonly tokensSalida?: number | null;
  }
  | { readonly tipo: "FALLAR"; readonly motivo: MotivoFallo; readonly detalle?: string }
  /** Lanza (en la llamada misma si `sincrono`, o rechazando la promesa) con un mensaje que no debe salir de la puerta. */
  | { readonly tipo: "LANZAR"; readonly sincrono?: boolean; readonly mensaje?: string }
  /** Devuelve tal cual algo que puede no cumplir el contrato. */
  | { readonly tipo: "DEVOLVER"; readonly resultado: unknown };

export type ConductaFalsa =
  | ConductaInmediata
  /** Espera `ms` y después se porta como `luego`; si la señal se aborta antes, devuelve TIEMPO_AGOTADO («ABORTADO»). */
  | { readonly tipo: "TARDAR"; readonly ms: number; readonly luego: ConductaInmediata }
  /** Nunca responde e ignora la señal: solo el límite del orquestador lo corta. */
  | { readonly tipo: "COLGAR" };

export interface OpcionesGeneradorFalso {
  readonly puerta: Puerta;
  /** Una conducta fija, o una por llamada (la primera llamada tiene índice 0). */
  readonly conducta: ConductaFalsa | ((indice: number) => ConductaFalsa);
}

export interface GeneradorFalso extends Generador {
  /** Los pedidos recibidos, en orden. */
  llamadas(): readonly PedidoGeneracion[];
}

export function crearGeneradorFalso(_opciones: OpcionesGeneradorFalso): GeneradorFalso { throw new Error("SIN_IMPLEMENTAR"); }
