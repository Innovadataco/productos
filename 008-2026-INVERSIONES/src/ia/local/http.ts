/**
 * El pedido HTTP de la puerta local. Nunca lanza: cada fallo vuelve como `FalloLocal`, sin datos del proveedor.
 * - Método y cabeceras fijos; `redirect: "manual"`: una redirección es un error, nunca se sigue.
 * - El «ok» lo decide el estado (200 a 299), no `respuesta.ok`. Todo cuerpo que no se va a leer se cancela.
 * - Cuerpo con tope de bytes, leído por flujo: se rechaza por el content-length declarado y se corta el flujo si lo
 *   pasa. Después, UTF-8 estricto y JSON.
 * - Clasificación: con el plazo abortado, TIEMPO_AGOTADO (con su causa); un rechazo del `fetch` (conexión rechazada u
 *   otro fallo de red) o un corte a mitad del cuerpo, MODELO_NO_DISPONIBLE; un estado que no es 2xx o un cuerpo
 *   grande o inválido, ERROR_PROVEEDOR.
 * - Cada espera compite con el plazo (`plazo.esperar`): un `fetch` que ignora la señal no cuelga al cliente.
 *
 * No se reusa `src/lib/http-acotado.ts`: solo hace GET y junta el plazo y la red en un mismo código.
 */
import type { RespuestaHttp } from "../../lib/http-acotado";
import { falloLocal, type DetalleDe, type FalloLocal } from "./errores";
import type { Plazo } from "./plazo";

export interface InitLocal {
  readonly method: "GET" | "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal: AbortSignal;
  readonly redirect: "manual";
}

/** El `fetch` inyectado (obligatorio): en las pruebas nunca hay red real. El `fetch` global de Node es asignable. */
export type BuscarLocal = (url: string, init: InitLocal) => Promise<RespuestaHttp>;

export type PeticionLocal = { readonly method: "GET" } | { readonly method: "POST"; readonly body: string };
export type ResultadoJsonLocal = { readonly ok: true; readonly datos: unknown } | FalloLocal;

/** Tags trae una entrada por modelo instalado. */
export const BYTES_MAXIMOS_TAGS = 262_144;
/** Generate trae, además de la salida, `context` (los tokens), `thinking` y escapes de JSON: el tope es del cuerpo entero. */
export const BYTES_MAXIMOS_GENERAR = 1_048_576;

const ACEPTA = Object.freeze({ accept: "application/json" });
const CON_CUERPO = Object.freeze({ accept: "application/json", "content-type": "application/json" });

type Lectura = { readonly ok: true; readonly bytes: Uint8Array } | FalloLocal;

const ignorar = (): void => undefined;
const cancelar = (respuesta: RespuestaHttp): void => {
  respuesta.body?.cancel().catch(ignorar);
};
const tiempo = (plazo: Plazo): FalloLocal => falloLocal("TIEMPO_AGOTADO", plazo.causa() === "SENAL_ABORTADA" ? "SENAL_ABORTADA" : "LIMITE_DEL_CLIENTE");

function detalleDeEstado(estado: unknown): DetalleDe<"ERROR_PROVEEDOR"> | null {
  if (typeof estado !== "number" || !Number.isInteger(estado) || estado < 200 || estado > 599) return "HTTP_ESTADO_INVALIDO";
  if (estado < 300) return null;
  if (estado < 400) return "HTTP_REDIRECCION";
  if (estado === 403) return "HTTP_PROHIBIDO";
  if (estado === 404) return "HTTP_NO_ENCONTRADO";
  return estado < 500 ? "HTTP_ERROR_CLIENTE" : "HTTP_ERROR_SERVIDOR";
}

/** ECONNREFUSED (nadie escucha en el puerto) frente a cualquier otro fallo de red. Solo se mira el código de la causa. */
function detalleDeRed(error: unknown): DetalleDe<"MODELO_NO_DISPONIBLE"> {
  const causa = error instanceof Error ? error.cause : undefined;
  const codigo = typeof causa === "object" && causa !== null ? (causa as { readonly code?: unknown }).code : undefined;
  return codigo === "ECONNREFUSED" ? "CONEXION_RECHAZADA" : "FALLO_DE_RED";
}

/** Une los trozos en un Uint8Array propio. */
function unir(partes: readonly Uint8Array[], total: number): Uint8Array {
  const salida = new Uint8Array(total);
  let posicion = 0;
  for (const parte of partes) {
    salida.set(parte, posicion);
    posicion += parte.byteLength;
  }
  return salida;
}

async function leerCuerpo(respuesta: RespuestaHttp, bytesMaximos: number, plazo: Plazo): Promise<Lectura> {
  if (Number(respuesta.headers.get("content-length")) > bytesMaximos) {
    cancelar(respuesta);
    return falloLocal("ERROR_PROVEEDOR", "CUERPO_DEMASIADO_GRANDE");
  }
  if (respuesta.body === null) return falloLocal("ERROR_PROVEEDOR", "CUERPO_INVALIDO");
  const lector = respuesta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const trozo = await plazo.esperar(lector.read());
    if (trozo.tipo === "ABORTADO") {
      lector.cancel().catch(ignorar);
      return tiempo(plazo);
    }
    if (trozo.tipo === "ERROR") return falloLocal("MODELO_NO_DISPONIBLE", "CONEXION_CORTADA");
    if (trozo.valor.done) return { ok: true, bytes: unir(partes, total) };
    total += trozo.valor.value.byteLength;
    if (total > bytesMaximos) {
      lector.cancel().catch(ignorar);
      return falloLocal("ERROR_PROVEEDOR", "CUERPO_DEMASIADO_GRANDE");
    }
    partes.push(trozo.valor.value);
  }
}

function aJson(bytes: Uint8Array): ResultadoJsonLocal {
  try {
    return { ok: true, datos: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown };
  } catch {
    return falloLocal("ERROR_PROVEEDOR", "CUERPO_INVALIDO");
  }
}

/** Llama al `fetch` sin dejar que lance; si la respuesta llega después del aborto, se cancela su cuerpo. */
function llamar(buscar: BuscarLocal, url: string, init: InitLocal, plazo: Plazo): Promise<RespuestaHttp> {
  let llamada: Promise<RespuestaHttp>;
  try {
    llamada = Promise.resolve(buscar(url, init));
  } catch (error) {
    return Promise.reject(error);
  }
  llamada.then((respuesta) => {
    if (plazo.senal.aborted) cancelar(respuesta);
  }, ignorar);
  return llamada;
}

/** Pide `url` con el plazo dado y devuelve el JSON del cuerpo. No lanza. */
export async function pedirJsonLocal(buscar: BuscarLocal, url: string, peticion: PeticionLocal, bytesMaximos: number, plazo: Plazo): Promise<ResultadoJsonLocal> {
  if (plazo.senal.aborted) return tiempo(plazo);
  const init: InitLocal = peticion.method === "POST"
    ? { method: "POST", headers: CON_CUERPO, body: peticion.body, signal: plazo.senal, redirect: "manual" }
    : { method: "GET", headers: ACEPTA, signal: plazo.senal, redirect: "manual" };
  const llegada = await plazo.esperar(llamar(buscar, url, init, plazo));
  if (llegada.tipo === "ABORTADO") return tiempo(plazo);
  // El rechazo que causa el aborto mismo llega después: la escucha del plazo se puso antes que la del `fetch`.
  if (llegada.tipo === "ERROR") return falloLocal("MODELO_NO_DISPONIBLE", detalleDeRed(llegada.error));
  // Si el plazo se abortó después de llegar la respuesta, la lectura del cuerpo lo ve y la cancela.
  const respuesta = llegada.valor;
  const detalle = detalleDeEstado(respuesta.status);
  if (detalle !== null) {
    cancelar(respuesta);
    return falloLocal("ERROR_PROVEEDOR", detalle);
  }
  const cuerpo = await leerCuerpo(respuesta, bytesMaximos, plazo);
  return cuerpo.ok ? aJson(cuerpo.bytes) : cuerpo;
}
