/**
 * El servidor HTTP del servicio inv-008-ia: solo traduce. Lee el método, la ruta (sin la consulta), la cabecera
 * `authorization` y un cuerpo con tope, se los pasa a la atención (`pedidos.ts`) y responde su JSON. Escucha en el
 * puerto fijo del servicio dentro del contenedor, que el compose NO publica: solo se llega por la red interna.
 * Sin log de los pedidos (ni cabeceras ni cuerpos). Topes de tiempo y de conexiones: es un servicio de un solo cliente.
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { Atender, RespuestaIa } from "./pedidos";

/** «Probar» manda solo `{"modelo":"…"}`: un nombre de modelo tiene hasta 129 caracteres. */
export const MAX_CUERPO_PEDIDO = 1024;
export const MAX_CONEXIONES = 8;
/** Cortos: un pedido es un cuerpo de menos de 1 KiB desde la red interna. Un cliente lento no retiene la conexión. */
const PLAZO_CABECERAS_MS = 2_000;
const PLAZO_PEDIDO_MS = 3_000;

/** El filtro previo: ¿la cabecera `authorization` es la debida? Se revisa ANTES de leer el cuerpo. */
export type FiltroPrevio = (autorizacion: string | undefined) => boolean;

const ERROR_INTERNO: RespuestaIa = { estado: 500, cuerpo: { error: "ERROR_INTERNO" } };
const DEMASIADO_GRANDE: RespuestaIa = { estado: 413, cuerpo: { error: "CUERPO_DEMASIADO_GRANDE" } };
const NO_AUTORIZADO: RespuestaIa = { estado: 401, cuerpo: { error: "NO_AUTORIZADO" } };

/** El cuerpo en UTF-8, o null si pasa del tope (deja de leer). */
function leerCuerpo(pedido: IncomingMessage): Promise<string | null> {
  return new Promise((resolver, rechazar) => {
    const partes: Buffer[] = [];
    let total = 0;
    let pasado = false;
    pedido.on("data", (parte: Buffer) => {
      total += parte.byteLength;
      if (pasado) return;
      if (total > MAX_CUERPO_PEDIDO) {
        // Deja de leer y responde ya: lo que siga llegando se descarta al cerrar la conexión.
        pasado = true;
        pedido.pause();
        resolver(null);
      } else partes.push(parte);
    });
    pedido.on("end", () => resolver(pasado ? null : Buffer.concat(partes).toString("utf8")));
    pedido.on("error", rechazar);
  });
}

async function resolver(atender: Atender, pedido: IncomingMessage, previo: FiltroPrevio | undefined): Promise<RespuestaIa> {
  if (previo !== undefined && !previo(pedido.headers.authorization)) return NO_AUTORIZADO;
  if (Number(pedido.headers["content-length"]) > MAX_CUERPO_PEDIDO) return DEMASIADO_GRANDE;
  const cuerpo = await leerCuerpo(pedido);
  if (cuerpo === null) return DEMASIADO_GRANDE;
  const ruta = (pedido.url ?? "").split("?")[0] ?? "";
  return atender({ metodo: pedido.method ?? "", ruta, autorizacion: pedido.headers.authorization, cuerpo });
}

/** `previo`: el filtro del token antes de leer el cuerpo (sin él, quien no lo trae ocuparía una conexión hasta el plazo). */
export function crearServidor(atender: Atender, previo?: FiltroPrevio): Server {
  const servidor = createServer((pedido, respuesta) => {
    resolver(atender, pedido, previo)
      .catch(() => ERROR_INTERNO)
      .then((r) => {
        const texto = JSON.stringify(r.cuerpo);
        respuesta.writeHead(r.estado, { "content-type": "application/json", "cache-control": "no-store", "content-length": Buffer.byteLength(texto), connection: "close" });
        // Al terminar se corta la conexión: lo que el cliente no alcanzó a mandar (un 401 o un 413) no se lee.
        respuesta.end(texto, () => pedido.destroy());
      })
      .catch(() => respuesta.destroy());
  });
  servidor.maxConnections = MAX_CONEXIONES;
  servidor.headersTimeout = PLAZO_CABECERAS_MS;
  servidor.requestTimeout = PLAZO_PEDIDO_MS;
  servidor.keepAliveTimeout = 1;
  return servidor;
}
