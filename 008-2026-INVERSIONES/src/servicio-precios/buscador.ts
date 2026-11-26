/**
 * Buscador fijo del servicio de precios: el `fetch` de los procesos de tarea (el despachador lo instala ANTES de
 * cargar cada CLI). Condiciones del CEO de PI (D-018), todas aquí y probadas en tests/unit/precios/servicio-buscador:
 * - lista blanca fija: Yahoo `query1.finance.yahoo.com` y `query2.finance.yahoo.com` (D-018 decía solo query1; query2 lo
 *   pide el ciclo intradía y lo aprueba el CEO de PI) y la SFC `www.datos.gov.co`, por https al 443, sin puerto escrito ni
 *   credenciales en la URL; cualquier otro destino se rechaza ANTES de conectar. Nada se suma por configuración;
 * - `redirect: "error"`: el pedido debe traerlo, y una respuesta 3xx es un error (nunca se sigue);
 * - nunca la IP del host: la conexión va solo a las IPv4 públicas que validó `crearLookupSeguro` (direcciones.ts).
 * Con `node:https` (no el fetch de undici) para poder fijar el `lookup` de la conexión. Pide `identity` (sin
 * compresión: el tope de bytes de http-acotado mide lo que llega) y rechaza una respuesta comprimida. Sin agente
 * compartido (sin conexiones vivas entre pedidos). Los errores dicen solo un código: nunca la ruta ni la consulta,
 * que traen el nemotécnico. Devuelve lo que usa `pedirJsonAcotado` (src/lib/http-acotado.ts).
 */
import type { ClientRequest, IncomingMessage } from "node:http";
import { request as pedirHttps, type RequestOptions } from "node:https";
import type { LookupFunction } from "node:net";
import type { BuscarHttp, RespuestaHttp } from "../lib/http-acotado";
import { HOSTS_YAHOO_INTRADIA } from "../precios/intradia/url";
import { crearLookupSeguro } from "./direcciones";

export const HOSTS_PERMITIDOS: readonly string[] = Object.freeze([...Object.values(HOSTS_YAHOO_INTRADIA), "www.datos.gov.co"]);
const PUERTO_HTTPS = 443;

/** `https.request` inyectable: en las pruebas la petición ya armada se reescribe hacia un servidor local. */
export type Solicitar = (opciones: RequestOptions, alResponder: (respuesta: IncomingMessage) => void) => ClientRequest;

export interface DependenciasBuscador {
  readonly solicitar?: Solicitar;
  readonly lookup?: LookupFunction;
}

/** La URL, si es uno de los destinos permitidos (la lista blanca fija); si no, null. */
function destinoPermitido(url: unknown, hosts: readonly string[]): URL | null {
  let u: URL;
  try {
    if (typeof url !== "string" && !(url instanceof URL)) return null;
    u = new URL(url);
  } catch {
    return null;
  }
  const limpia = u.protocol === "https:" && u.username === "" && u.password === "" && u.port === "";
  return limpia && hosts.includes(u.hostname) ? u : null;
}

/** Las del pedido (en minúsculas), `accept: *\/*` si no viene y siempre `accept-encoding: identity`. */
function cabeceras(propias: Readonly<Record<string, string>> | undefined): Record<string, string> {
  const delPedido = Object.entries(propias ?? {}).map(([k, v]) => [k.toLowerCase(), v] as const);
  return { accept: "*/*", ...Object.fromEntries(delPedido), "accept-encoding": "identity" };
}

/** El cuerpo de la respuesta como ReadableStream, con contrapresión; un corte antes del final es un error. */
function flujoWeb(respuesta: IncomingMessage): ReadableStream<Uint8Array> {
  let cerrado = false;
  return new ReadableStream<Uint8Array>({
    start(control) {
      const una = (accion: () => void) => {
        if (cerrado) return;
        cerrado = true;
        accion();
      };
      respuesta.on("data", (parte: Buffer) => {
        if (cerrado) return;
        control.enqueue(new Uint8Array(parte));
        // desiredSize es null solo con el flujo en error, y entonces `cerrado` ya cortó arriba.
        if (Number(control.desiredSize) <= 0) respuesta.pause();
      });
      respuesta.once("end", () => una(() => control.close()));
      // on y no once: un abort y luego el reset del socket pueden emitir dos «error»; sin oyente, el segundo tumbaría
      // el proceso. `una` hace que solo el primero cuente.
      respuesta.on("error", (error) => una(() => control.error(error)));
      respuesta.once("close", () => una(() => control.error(new Error("PRECIOS_RED: la respuesta se cortó"))));
    },
    pull() {
      respuesta.resume();
    },
    cancel() {
      cerrado = true;
      respuesta.destroy();
    },
  });
}

function respuestaHttp(respuesta: IncomingMessage): RespuestaHttp {
  const estado = Number(respuesta.statusCode);
  return {
    ok: estado >= 200 && estado < 300,
    status: estado,
    headers: {
      get: (nombre) => {
        const valor = respuesta.headers[nombre.toLowerCase()];
        if (valor === undefined) return null;
        return Array.isArray(valor) ? valor.join(", ") : valor;
      },
    },
    body: flujoWeb(respuesta),
  };
}

/** Rechazo de la respuesta, o null si se puede leer: 3xx (redirect "error") o un cuerpo comprimido. */
function rechazoDe(respuesta: IncomingMessage): TypeError | null {
  const estado = Number(respuesta.statusCode);
  if (estado >= 300 && estado < 400) return new TypeError("PRECIOS_REDIRECCION_RECHAZADA");
  const codificacion = respuesta.headers["content-encoding"];
  if (codificacion !== undefined && codificacion.trim().toLowerCase() !== "identity") return new TypeError("PRECIOS_CODIFICACION");
  return null;
}

/** El `fetch` de los procesos de tarea: solo la lista blanca fija, con redirect "error" y a IPv4 públicas. */
export function crearBuscadorFijo(deps: DependenciasBuscador = {}): BuscarHttp {
  const solicitar = deps.solicitar ?? pedirHttps;
  const lookup = deps.lookup ?? crearLookupSeguro();
  const buscarFijo: BuscarHttp = (url, init) =>
    new Promise<RespuestaHttp>((resolver, rechazar) => {
      const destino = destinoPermitido(url, HOSTS_PERMITIDOS);
      if (!destino) return rechazar(new TypeError("PRECIOS_DESTINO_NO_PERMITIDO"));
      if (init?.redirect !== "error") return rechazar(new TypeError("PRECIOS_REDIRECCION_NO_ERROR"));
      const opciones: RequestOptions = {
        protocol: "https:",
        hostname: destino.hostname,
        port: PUERTO_HTTPS,
        method: "GET",
        path: `${destino.pathname}${destino.search}`,
        servername: destino.hostname,
        headers: cabeceras(init.headers),
        lookup,
        agent: false,
        signal: init.signal,
      };
      const pedido = solicitar(opciones, (respuesta) => {
        const rechazo = rechazoDe(respuesta);
        if (!rechazo) return resolver(respuestaHttp(respuesta));
        respuesta.destroy();
        rechazar(rechazo);
      });
      pedido.once("error", (error) => rechazar(new TypeError("PRECIOS_RED", { cause: error })));
      pedido.end();
    });
  return buscarFijo;
}

/** El `fetch` del proceso del bucle y de --ahora: nunca sale a la red (las tareas corren en sus propios procesos). */
export function buscadorQueRechaza(): BuscarHttp {
  const buscarRechazado: BuscarHttp = async () => {
    throw new TypeError("PRECIOS_SIN_RED_EN_EL_BUCLE");
  };
  return buscarRechazado;
}
