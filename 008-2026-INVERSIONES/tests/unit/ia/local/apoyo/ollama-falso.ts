/**
 * Un `fetch` falso de Ollama, sin red: responde según un guion por llamada y ANOTA cada llamada (url, método,
 * cabeceras, cuerpo, redirect y señal). Las violaciones (una URL o un método fuera de la lista, o un redirect que no es
 * «manual») se anotan en vez de lanzar: si lanzara, el cliente lo leería como un fallo de red y la prueba pasaría en
 * falso. `vigilarFalsos()` exige cero violaciones al final de cada prueba del archivo que lo llame.
 */
import { afterEach, expect } from "vitest";
import type { BuscarLocal, InitLocal } from "@/ia/local/http";
import type { RespuestaHttp } from "@/lib/http-acotado";
import { DIGEST_LOCAL_FICTICIO, MODELO_LOCAL_FICTICIO, OTRO_DIGEST_FICTICIO, SALIDA_FICTICIA, URL_GENERAR, URL_TAGS } from "./red.ficticio";

export interface LlamadaFalsa {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | undefined;
  readonly redirect: string;
  readonly signal: AbortSignal;
}

type Encabezados = Readonly<Record<string, string>>;

export type RespuestaFalsa =
  | { readonly tipo: "JSON"; readonly cuerpo: unknown; readonly estado?: number; readonly encabezados?: Encabezados }
  | { readonly tipo: "TEXTO"; readonly texto: string; readonly estado?: number; readonly encabezados?: Encabezados }
  | { readonly tipo: "FLUJO"; readonly flujo: ReadableStream<Uint8Array>; readonly estado?: number; readonly encabezados?: Encabezados }
  /** Una respuesta armada a mano (estados que `Response` no admite, encabezados que mienten). */
  | { readonly tipo: "CRUDA"; readonly respuesta: RespuestaHttp }
  | { readonly tipo: "RECHAZAR"; readonly error: unknown }
  /** Lanza en la llamada misma, sin devolver promesa. */
  | { readonly tipo: "LANZAR"; readonly error: unknown }
  | { readonly tipo: "PROMESA"; readonly promesa: Promise<RespuestaHttp> }
  /** Nunca responde e ignora la señal: solo el límite del cliente lo corta. */
  | { readonly tipo: "COLGAR" };

export type Guion = (llamada: LlamadaFalsa, indice: number) => RespuestaFalsa;

export interface OllamaFalso {
  readonly fetch: BuscarLocal;
  llamadas(): readonly LlamadaFalsa[];
  violaciones(): readonly string[];
}

const PERMITIDAS: Readonly<Record<string, string>> = Object.freeze({ [URL_TAGS]: "GET", [URL_GENERAR]: "POST" });
const creados: OllamaFalso[] = [];

function respuestaDe(r: Exclude<RespuestaFalsa, { tipo: "CRUDA" | "RECHAZAR" | "LANZAR" | "PROMESA" | "COLGAR" }>): Response {
  const init = { status: r.estado ?? 200, headers: { "content-type": "application/json; charset=utf-8", ...r.encabezados } };
  if (r.tipo === "JSON") return new Response(JSON.stringify(r.cuerpo), init);
  if (r.tipo === "TEXTO") return new Response(r.texto, init);
  return new Response(r.flujo, init);
}

export function crearOllamaFalso(guion: Guion): OllamaFalso {
  const llamadas: LlamadaFalsa[] = [];
  const violaciones: string[] = [];
  const buscar: BuscarLocal = (url: string, init: InitLocal): Promise<RespuestaHttp> => {
    const llamada: LlamadaFalsa = { url, method: init.method, headers: { ...init.headers }, body: init.body, redirect: init.redirect, signal: init.signal };
    if (PERMITIDAS[url] === undefined) violaciones.push("URL_NO_PERMITIDA");
    else if (PERMITIDAS[url] !== init.method) violaciones.push("METODO_NO_PERMITIDO");
    if (init.redirect !== "manual") violaciones.push("REDIRECT_NO_MANUAL");
    const respuesta = guion(llamada, llamadas.length);
    llamadas.push(llamada);
    switch (respuesta.tipo) {
      case "CRUDA":
        return Promise.resolve(respuesta.respuesta);
      case "RECHAZAR":
        return Promise.reject(respuesta.error);
      case "LANZAR":
        throw respuesta.error;
      case "PROMESA":
        return respuesta.promesa;
      case "COLGAR":
        return new Promise<RespuestaHttp>(() => undefined);
      default:
        return Promise.resolve(respuestaDe(respuesta));
    }
  };
  const falso: OllamaFalso = Object.freeze({
    fetch: buscar,
    llamadas: (): readonly LlamadaFalsa[] => Object.freeze([...llamadas]),
    violaciones: (): readonly string[] => Object.freeze([...violaciones]),
  });
  creados.push(falso);
  return falso;
}

/** Al final de cada prueba del archivo: ningún falso creado vio una URL, un método o un redirect fuera de lo permitido. */
export function vigilarFalsos(): void {
  afterEach(() => {
    const vistas = creados.flatMap((falso) => falso.violaciones());
    creados.length = 0;
    expect(vistas).toEqual([]);
  });
}

export const json = (cuerpo: unknown, estado = 200): RespuestaFalsa => ({ tipo: "JSON", cuerpo, estado });

export interface EntradaTags {
  readonly nombre: string;
  readonly digest: string;
}

/** El cuerpo de `/api/tags` con la forma de la documentación de Ollama (valores inventados, fechas de 2027). */
export function tagsCon(modelos: readonly EntradaTags[]): unknown {
  return {
    models: modelos.map(({ nombre, digest }) => ({
      name: nombre,
      model: nombre,
      modified_at: "2027-04-13T19:07:41.317Z",
      size: 5613472913,
      digest,
      details: { parent_model: "", format: "gguf", family: "ficticia", families: ["ficticia"], parameter_size: "7.3B", quantization_level: "Q4_K_M" },
    })),
  };
}

export const tagsDelFicticio = (digest = DIGEST_LOCAL_FICTICIO): unknown =>
  tagsCon([{ nombre: "otro-ficticio:1b", digest: OTRO_DIGEST_FICTICIO }, { nombre: MODELO_LOCAL_FICTICIO, digest }]);

/** El cuerpo de `/api/generate` sin flujo, con la forma de la documentación (valores inventados). */
export function generacionFicticia(extra: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    model: MODELO_LOCAL_FICTICIO,
    created_at: "2027-04-13T19:07:43.613Z",
    response: SALIDA_FICTICIA,
    done: true,
    done_reason: "stop",
    context: [1237, 4613, 271],
    total_duration: 4613271903,
    load_duration: 37911475,
    prompt_eval_count: 613,
    prompt_eval_duration: 1237519,
    eval_count: 271,
    eval_duration: 3517913,
    ...extra,
  };
}

/** Tags con el modelo ficticio y después la generación dada; repite el par en cada pedido. */
export const guionFeliz = (generacion: unknown = generacionFicticia()): Guion => (_llamada, indice) => json(indice % 2 === 0 ? tagsDelFicticio() : generacion);

export interface Diferido<T> {
  readonly promesa: Promise<T>;
  resolver(valor: T): void;
  rechazar(error: unknown): void;
}

export function diferido<T>(): Diferido<T> {
  let resolver: (valor: T) => void = () => undefined;
  let rechazar: (error: unknown) => void = () => undefined;
  const promesa = new Promise<T>((si, no) => {
    resolver = si;
    rechazar = no;
  });
  return { promesa, resolver, rechazar };
}

export interface FlujoVigilado {
  readonly flujo: ReadableStream<Uint8Array>;
  cancelado(): boolean;
  leido(): boolean;
}

/**
 * Un flujo con los trozos dados y después, según `final`: terminar, fallar (corte de la conexión) o quedarse colgado.
 * Anota si alguien lo leyó y si lo cancelaron. Con `cancelarRechaza`, cancelar rechaza (el cliente no debe lanzar).
 */
export function flujoVigilado(trozos: readonly Uint8Array[], final: "TERMINAR" | "FALLAR" | "COLGAR" = "TERMINAR", cancelarRechaza = false): FlujoVigilado {
  let cancelado = false;
  let leido = false;
  let i = 0;
  const flujo = new ReadableStream<Uint8Array>({
    pull(control) {
      leido = true;
      if (i < trozos.length) {
        control.enqueue(trozos[i] as Uint8Array);
        i += 1;
        return undefined;
      }
      if (final === "TERMINAR") control.close();
      if (final === "FALLAR") control.error(new Error("conexión cortada FICTICIA-ALFA 4613.27"));
      return final === "COLGAR" ? new Promise<void>(() => undefined) : undefined;
    },
    cancel() {
      cancelado = true;
      return cancelarRechaza ? Promise.reject(new Error("cancelar falló")) : undefined;
    },
  }, { highWaterMark: 0 });
  return { flujo, cancelado: () => cancelado, leido: () => leido };
}

/** Una respuesta a mano: el estado, `ok` y el content-length que se quieran (aunque mientan). */
export function respuestaCruda(estado: unknown, opciones: { readonly ok?: boolean; readonly contentLength?: string; readonly cuerpo?: ReadableStream<Uint8Array> | null } = {}): RespuestaHttp {
  const encabezados = new Headers(opciones.contentLength === undefined ? {} : { "content-length": opciones.contentLength });
  return { ok: opciones.ok ?? false, status: estado as number, headers: { get: (nombre: string) => encabezados.get(nombre) }, body: opciones.cuerpo ?? null };
}

export const bytes = (texto: string): Uint8Array => new TextEncoder().encode(texto);

/** El error de undici cuando nadie escucha en el puerto: un TypeError con la causa ECONNREFUSED. */
export const conexionRechazada = (): Error => new TypeError("fetch failed", { cause: Object.assign(new Error("connect ECONNREFUSED FICTICIA-ALFA"), { code: "ECONNREFUSED" }) });
export const hostInalcanzable = (): Error => new TypeError("fetch failed", { cause: Object.assign(new Error("connect EHOSTUNREACH FICTICIA-ALFA"), { code: "EHOSTUNREACH" }) });
