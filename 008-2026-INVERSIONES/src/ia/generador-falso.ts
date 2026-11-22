/**
 * Generador falso, sin red: responde, falla, lanza, tarda o se cuelga según se le configure. Lo usan las pruebas de
 * las puertas, del validador y de los clientes. Guarda cada pedido que recibe (`llamadas()`) para contar llamadas y
 * revisar qué le llegó. No es para producción: ningún punto de entrada de la app debe importarlo.
 */
import type { Generador, MotivoFalloGenerador, PedidoGeneracion, Puerta, ResultadoGeneracion } from "./generador";

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
  | { readonly tipo: "FALLAR"; readonly motivo: MotivoFalloGenerador; readonly detalle?: string }
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

const MENSAJE_POR_OMISION = "fallo del generador falso";

function inmediata(conducta: ConductaInmediata, puerta: Puerta): Promise<ResultadoGeneracion> {
  switch (conducta.tipo) {
    case "RESPONDER":
      return Promise.resolve({
        ok: true,
        puerta,
        salidaCruda: conducta.salidaCruda,
        modelo: conducta.modelo ?? MODELO_FICTICIO,
        modeloDigest: conducta.modeloDigest ?? DIGEST_FICTICIO,
        latenciaMs: conducta.latenciaMs ?? 0,
        tokensEntrada: conducta.tokensEntrada ?? null,
        tokensSalida: conducta.tokensSalida ?? null,
      });
    case "FALLAR":
      return Promise.resolve({ ok: false, puerta, motivo: conducta.motivo, detalle: conducta.detalle ?? "FALLO_FICTICIO" });
    case "LANZAR":
      return Promise.reject(new Error(conducta.mensaje ?? MENSAJE_POR_OMISION));
    case "DEVOLVER":
      return Promise.resolve(conducta.resultado as ResultadoGeneracion);
  }
}

function tardar(ms: number, luego: ConductaInmediata, puerta: Puerta, senal: AbortSignal): Promise<ResultadoGeneracion> {
  const abortado: ResultadoGeneracion = { ok: false, puerta, motivo: "TIEMPO_AGOTADO", detalle: "ABORTADO" };
  if (senal.aborted) return Promise.resolve(abortado);
  return new Promise((resolver) => {
    const alAbortar = (): void => {
      clearTimeout(temporizador);
      resolver(abortado);
    };
    const temporizador = setTimeout(() => {
      senal.removeEventListener("abort", alAbortar);
      resolver(inmediata(luego, puerta));
    }, ms);
    senal.addEventListener("abort", alAbortar, { once: true });
  });
}

export function crearGeneradorFalso(opciones: OpcionesGeneradorFalso): GeneradorFalso {
  const pedidos: PedidoGeneracion[] = [];
  const { puerta } = opciones;
  const conductaDe = (indice: number): ConductaFalsa => (typeof opciones.conducta === "function" ? opciones.conducta(indice) : opciones.conducta);
  return Object.freeze({
    puerta,
    generar(pedido: PedidoGeneracion, senal: AbortSignal): Promise<ResultadoGeneracion> {
      const conducta = conductaDe(pedidos.length);
      pedidos.push(pedido);
      if (conducta.tipo === "LANZAR" && conducta.sincrono === true) throw new Error(conducta.mensaje ?? MENSAJE_POR_OMISION);
      if (conducta.tipo === "COLGAR") return new Promise<ResultadoGeneracion>(() => undefined);
      if (conducta.tipo === "TARDAR") return tardar(conducta.ms, conducta.luego, puerta, senal);
      return inmediata(conducta, puerta);
    },
    llamadas: (): readonly PedidoGeneracion[] => Object.freeze([...pedidos]),
  });
}
