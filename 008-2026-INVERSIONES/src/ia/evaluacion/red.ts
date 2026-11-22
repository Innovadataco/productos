/**
 * La red vigilada del arnés (E7): el `fetch` que recibe la puerta local pasa por esta lista cerrada, además de la del
 * cliente (defensa en profundidad, como el proxy que pidió PI en el Mac):
 * - solo GET de tags y POST de generate del destino (armados con `urlLocal`, la misma regla del cliente);
 * - `redirect: "manual"`;
 * - un pedido a la vez (PI tiene la prioridad en el Mac).
 * Lo demás se rechaza SIN llamar al fetch de abajo, con `ErrorRedVigilada` (el cliente lo lee como un defecto de la
 * dependencia, ERROR_PROVEEDOR, nunca como una caída de red) y se cuenta: un rechazo es un defecto que el script
 * informa con salida 1. Nunca repite el destino.
 */
import type { BuscarLocal, InitLocal } from "../local/http";
import { leerDestinoLocal, RUTAS_LOCALES, urlLocal, type RutaLocal } from "../local/destino";
import type { RespuestaHttp } from "../../lib/http-acotado";

export const CODIGOS_RED_VIGILADA = Object.freeze(["RUTA_NO_PERMITIDA", "METODO_NO_PERMITIDO", "REDIRECT_NO_MANUAL", "PEDIDO_CONCURRENTE"] as const);
export type CodigoRedVigilada = (typeof CODIGOS_RED_VIGILADA)[number];

export class ErrorRedVigilada extends Error {
  override readonly name = "ErrorRedVigilada";
  constructor(readonly codigo: CodigoRedVigilada) {
    super(`Red vigilada del arnés: ${codigo}.`);
  }
}

/**
 * La ruta de la lista cerrada del cliente que termina así (sin escribir aquí ninguna ruta de Ollama). Si faltara,
 * `urlLocal` la rechaza con RUTA_NO_PERMITIDA: cierra en fallo al crear la red.
 */
const ruta = (fin: string): RutaLocal => RUTAS_LOCALES.find((r) => r.endsWith(fin)) as RutaLocal;

export interface ConteoRed {
  readonly tags: number;
  readonly generar: number;
  readonly rechazados: number;
}

export interface RedVigilada {
  readonly buscar: BuscarLocal;
  conteo(): ConteoRed;
}

/** El fetch vigilado hacia `destino` (validado como el de la puerta local: lanza `ErrorLocal` sin repetirlo). */
export function vigilarRed(buscar: BuscarLocal, destino: string): RedVigilada {
  const revisado = leerDestinoLocal(destino);
  const permitidas = new Map<string, { readonly metodo: InitLocal["method"]; readonly ruta: "tags" | "generar" }>([
    [urlLocal(revisado, ruta("/tags")), { metodo: "GET", ruta: "tags" }],
    [urlLocal(revisado, ruta("/generate")), { metodo: "POST", ruta: "generar" }],
  ]);
  const cuenta = { tags: 0, generar: 0, rechazados: 0 };
  let enVuelo = false;

  const rechazar = (codigo: CodigoRedVigilada): Promise<RespuestaHttp> => {
    cuenta.rechazados += 1;
    return Promise.reject(new ErrorRedVigilada(codigo));
  };

  const vigilado: BuscarLocal = (url, init) => {
    const permitida = permitidas.get(url);
    if (permitida === undefined) return rechazar("RUTA_NO_PERMITIDA");
    if (permitida.metodo !== init.method) return rechazar("METODO_NO_PERMITIDO");
    if (init.redirect !== "manual") return rechazar("REDIRECT_NO_MANUAL");
    if (enVuelo) return rechazar("PEDIDO_CONCURRENTE");
    enVuelo = true;
    cuenta[permitida.ruta] += 1;
    let llamada: Promise<RespuestaHttp>;
    try {
      llamada = Promise.resolve(buscar(url, init));
    } catch (error) {
      enVuelo = false;
      return Promise.reject(error);
    }
    return llamada.finally(() => {
      enVuelo = false;
    });
  };

  return Object.freeze({ buscar: vigilado, conteo: (): ConteoRed => Object.freeze({ ...cuenta }) });
}
