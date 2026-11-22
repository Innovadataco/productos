import "server-only";
/**
 * El cliente del SDK oficial con sus opciones cerradas, y el `fetch` que usa, envuelto:
 * - credencial: la llave propia, pasada como función (así no queda en el campo público `apiKey` del SDK y el SDK no
 *   busca otra en el entorno: ni ANTHROPIC_API_KEY, ni ANTHROPIC_AUTH_TOKEN, ni perfiles); `webhookKey: null`;
 * - destino fijo (`baseURL` explícita: ANTHROPIC_BASE_URL no cuenta), sin reintentos, sin registro (`logLevel: "off"`:
 *   ANTHROPIC_LOG no cuenta) y sin trazas de OpenTelemetry;
 * - el `fetch` envuelto solo deja salir un POST a la API de mensajes, con cabeceras fijas (la versión de la API,
 *   accept, content-type y la llave propia en `authorization`; del SDK solo pasa el `user-agent`): el SDK lee
 *   ANTHROPIC_CUSTOM_HEADERS siempre y las pone DESPUÉS de la credencial, así que no cuelan nada; sin seguir
 *   redirecciones; y lee el cuerpo de la respuesta DENTRO del fetch, con un tope de bytes,
 *   para que el tiempo del SDK cubra también la lectura y nada se lea entero sin límite.
 * El `fetch` base se inyecta: en las pruebas, uno falso; en el servicio (E6), el que sale por el proxy de salida.
 */
import { Anthropic } from "@anthropic-ai/sdk";
import type { LlaveNube } from "./config";
import type { ClienteMensajes } from "./peticion";

export const URL_BASE_NUBE = "https://api.anthropic.com";
export const URL_MENSAJES_NUBE = `${URL_BASE_NUBE}/v1/messages`;
/** Tope de la respuesta: holgado para `MAX_TOKENS_NUBE` de salida en JSON; más es un error del proveedor. */
export const MAX_BYTES_RESPUESTA_NUBE = 1_048_576;
export const CABECERAS_PERMITIDAS_NUBE = Object.freeze(["accept", "anthropic-version", "authorization", "content-type", "user-agent"] as const);
/** La versión de la API: la que manda el SDK 1.x, fija aquí (ni el entorno ni una subida del SDK la cambian sin revisión). */
export const VERSION_API_NUBE = "2026-10-21";

export type CodigoTransporteNube = "DESTINO_NO_PERMITIDO" | "RESPUESTA_DEMASIADO_GRANDE";

/** El transporte se negó (sin repetir lo recibido): el SDK lo envuelve como error de conexión con esta causa. */
export class ErrorTransporteNube extends Error {
  override readonly name = "ErrorTransporteNube";
  constructor(readonly codigo: CodigoTransporteNube) {
    super(`Transporte de la nube: ${codigo}.`);
  }
}

function destinoPermitido(entrada: unknown, metodo: string | undefined): boolean {
  if (metodo !== "POST" || !(typeof entrada === "string" || entrada instanceof URL)) return false;
  return URL.canParse(String(entrada)) && new URL(String(entrada)).href === URL_MENSAJES_NUBE;
}

/** Las cabeceras que salen: fijas, salvo el `user-agent` del SDK; la llave, la propia. */
function cabecerasPermitidas(origen: HeadersInit | undefined, llave: LlaveNube): Headers {
  const salida = new Headers({
    accept: "application/json",
    "anthropic-version": VERSION_API_NUBE,
    authorization: `Bearer ${llave.revelar()}`,
    "content-type": "application/json",
  });
  const agente = new Headers(origen).get("user-agent");
  if (agente !== null) salida.set("user-agent", agente);
  return salida;
}

/** El cuerpo entero si no pasa del tope; si pasa, cancela la lectura y lanza. */
async function leerAcotado(respuesta: Response): Promise<Uint8Array<ArrayBuffer> | null> {
  if (respuesta.body === null) return null;
  const lector = respuesta.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES_RESPUESTA_NUBE) {
      await lector.cancel();
      throw new ErrorTransporteNube("RESPUESTA_DEMASIADO_GRANDE");
    }
    trozos.push(value);
  }
  const cuerpo = new Uint8Array(new ArrayBuffer(total));
  let desde = 0;
  for (const trozo of trozos) {
    cuerpo.set(trozo, desde);
    desde += trozo.byteLength;
  }
  return cuerpo;
}

/** El `fetch` que recibe el SDK: un solo destino, cabeceras cerradas, sin redirecciones y la respuesta ya leída. */
export function envolverFetch(base: typeof fetch, llave: LlaveNube): typeof fetch {
  const envuelto = async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!destinoPermitido(entrada, init?.method)) throw new ErrorTransporteNube("DESTINO_NO_PERMITIDO");
    const respuesta = await base(URL_MENSAJES_NUBE, {
      method: "POST",
      headers: cabecerasPermitidas(init?.headers, llave),
      body: init?.body ?? null,
      signal: init?.signal ?? null,
      redirect: "error",
    });
    const cuerpo = await leerAcotado(respuesta);
    return new Response(cuerpo === null || cuerpo.byteLength === 0 ? null : cuerpo, { status: respuesta.status, statusText: respuesta.statusText, headers: respuesta.headers });
  };
  return envuelto as typeof fetch;
}

export interface OpcionesClienteNube {
  readonly llave: LlaveNube;
  /** El `fetch` de abajo (el global, uno falso en las pruebas o el del proxy de salida). */
  readonly fetchBase: typeof fetch;
}

/** El cliente del SDK con las opciones cerradas. Construirlo no llama a la red. */
export function crearClienteAnthropic(opciones: OpcionesClienteNube): ClienteMensajes {
  const { llave, fetchBase } = opciones;
  return new Anthropic({
    apiKey: () => Promise.resolve(llave.revelar()),
    baseURL: URL_BASE_NUBE,
    webhookKey: null,
    maxRetries: 0,
    logLevel: "off",
    openTelemetry: false,
    fetch: envolverFetch(fetchBase, llave),
  });
}
