/**
 * Pedidos HTTP con topes, comunes a las fuentes externas: JSON (Yahoo y SFC) y bytes (XML y xlsx de las fuentes oficiales).
 * - No sigue redirecciones (`redirect: "error"`).
 * - Plazo total (pedido + cuerpo) con reloj propio: vale aunque `buscar` o el flujo ignoren la señal.
 * - Tope de bytes del cuerpo: rechaza por el content-length declarado y corta el flujo si lo pasa.
 * - JSON: UTF-8 estricto y JSON. Bytes: lista de content-type aceptados y los bytes tal cual (no decodifica).
 * - Nunca lanza: los fallos vuelven como `<PREFIJO>_RED`, `<PREFIJO>_HTTP_<estado>`, `<PREFIJO>_FORMATO` o (solo los
 *   bytes) `<PREFIJO>_TIPO`.
 */

/** Lo que se usa de la respuesta de `fetch`: estado, encabezados y el cuerpo como flujo (para ponerle tope). */
export interface RespuestaHttp {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: { get(nombre: string): string | null };
  readonly body: ReadableStream<Uint8Array> | null;
}

export interface InitHttp {
  readonly headers: Record<string, string>;
  readonly signal: AbortSignal;
  readonly redirect: "error";
}

/** `fetch` inyectable: en las pruebas nunca hay red real. */
export type BuscarHttp = (url: string, init: InitHttp) => Promise<RespuestaHttp>;

export interface LimitesPedido {
  readonly prefijo: string;
  readonly headers: Record<string, string>;
  readonly bytesMaximos: number;
  readonly tiempoMaximoMs: number;
}

export interface LimitesPedidoBytes extends LimitesPedido {
  /** Tipos de contenido aceptados (`tipo/subtipo`, sin parámetros); se comparan exactos, sin mayúsculas. */
  readonly tiposAceptados: readonly string[];
}

type Fallo = { readonly ok: false; readonly codigo: string };
export type ResultadoPedido = { readonly ok: true; readonly datos: unknown } | Fallo;
export type ResultadoBytes = { readonly ok: true; readonly bytes: Uint8Array } | Fallo;

type Falla = "RED" | "FORMATO" | "TIPO";
type Lectura = { readonly ok: true; readonly bytes: Uint8Array } | { readonly ok: false; readonly falla: Falla };

const fallo = (prefijo: string, falla: Falla): Fallo => ({ ok: false, codigo: `${prefijo}_${falla}` });

/** Cancela un cuerpo que no se va a leer (sin esperar ni lanzar). */
const descartar = (respuesta: RespuestaHttp): void => void respuesta.body?.cancel().catch(() => undefined);

/** Une los trozos en un Uint8Array propio (nunca un Buffer del pool compartido de Node). */
function unir(partes: readonly Uint8Array[], total: number): Uint8Array {
  const salida = new Uint8Array(total);
  let p = 0;
  for (const parte of partes) {
    salida.set(parte, p);
    p += parte.byteLength;
  }
  return salida;
}

/**
 * Lee el cuerpo con tope de bytes: rechaza por el content-length declarado y corta el flujo si lo pasa. Con
 * `descartarSiRechaza`, un cuerpo rechazado por el content-length se cancela sin leerlo.
 */
async function leerCuerpoAcotado(respuesta: RespuestaHttp, bytesMaximos: number, senal: AbortSignal, descartarSiRechaza: boolean): Promise<Lectura> {
  const declarado = Number(respuesta.headers.get("content-length"));
  if (declarado > bytesMaximos || !respuesta.body) {
    if (descartarSiRechaza) descartar(respuesta);
    return { ok: false, falla: "FORMATO" };
  }
  const lector = respuesta.body.getReader();
  const cancelar = (): void => void lector.cancel().catch(() => undefined);
  if (senal.aborted) {
    // El plazo venció antes de que llegara la respuesta: nadie espera ya este cuerpo.
    cancelar();
    return { ok: false, falla: "RED" };
  }
  senal.addEventListener("abort", cancelar, { once: true });
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    for (let parte = await lector.read(); !parte.done; parte = await lector.read()) {
      total += parte.value.byteLength;
      if (total > bytesMaximos) {
        await lector.cancel().catch(() => undefined);
        return { ok: false, falla: "FORMATO" };
      }
      partes.push(parte.value);
    }
  } catch {
    return { ok: false, falla: "RED" };
  } finally {
    senal.removeEventListener("abort", cancelar);
  }
  if (senal.aborted) return { ok: false, falla: "RED" };
  return { ok: true, bytes: unir(partes, total) };
}

/** ¿El content-type está en la lista? Solo `tipo/subtipo` exacto; un charset, si viene, tiene que ser UTF-8. */
function tipoAceptado(valor: string | null, aceptados: readonly string[]): boolean {
  if (valor === null) return false;
  const [tipo, ...parametros] = valor.split(";").map((p) => p.trim().toLowerCase());
  if (!tipo || !aceptados.some((a) => a.toLowerCase() === tipo)) return false;
  return parametros.every((p) => {
    const [clave, ...resto] = p.split("=");
    return clave?.trim() !== "charset" || resto.join("=").trim().replace(/^"(.*)"$/, "$1") === "utf-8";
  });
}

/**
 * Pedido y lectura, sin plazo propio: la señal la pone `conPlazo`. Con `aceptados` (la vía de bytes), el content-type
 * se mira antes de leer el cuerpo, y todo cuerpo rechazado sin leer (estado de error, tipo o content-length) se cancela.
 * La vía de JSON (`aceptados` null) queda como estaba en main: no cancela (deuda aparte, para no cambiar su
 * comportamiento en este cambio). No lanza.
 */
async function pedirCuerpo(buscar: BuscarHttp, url: string, limites: LimitesPedido, senal: AbortSignal, aceptados: readonly string[] | null): Promise<ResultadoBytes> {
  let respuesta: RespuestaHttp;
  try {
    respuesta = await buscar(url, { headers: limites.headers, signal: senal, redirect: "error" });
  } catch {
    return fallo(limites.prefijo, "RED");
  }
  const esBytes = aceptados !== null;
  if (!respuesta.ok) {
    if (esBytes) descartar(respuesta);
    return { ok: false, codigo: `${limites.prefijo}_HTTP_${respuesta.status}` };
  }
  if (esBytes && !tipoAceptado(respuesta.headers.get("content-type"), aceptados)) {
    descartar(respuesta);
    return fallo(limites.prefijo, "TIPO");
  }
  const cuerpo = await leerCuerpoAcotado(respuesta, limites.bytesMaximos, senal, esBytes);
  return cuerpo.ok ? cuerpo : fallo(limites.prefijo, cuerpo.falla);
}

/**
 * Corre `trabajo` dentro de `tiempoMaximoMs`. Al vencer el plazo se aborta la señal (que corta `fetch` y su cuerpo)
 * y se responde `<PREFIJO>_RED` sin esperar más. No lanza.
 */
async function conPlazo<T extends { readonly ok: boolean }>(limites: LimitesPedido, trabajo: (senal: AbortSignal) => Promise<T | Fallo>): Promise<T | Fallo> {
  const controlador = new AbortController();
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const vencido = new Promise<Fallo>((resolver) => {
    reloj = setTimeout(() => {
      controlador.abort();
      resolver(fallo(limites.prefijo, "RED"));
    }, limites.tiempoMaximoMs);
  });
  try {
    return await Promise.race([trabajo(controlador.signal), vencido]);
  } catch {
    return fallo(limites.prefijo, "RED");
  } finally {
    clearTimeout(reloj);
  }
}

/** Pide `url` y devuelve el JSON del cuerpo (UTF-8 estricto), todo dentro de `tiempoMaximoMs`. No lanza. */
export async function pedirJsonAcotado(buscar: BuscarHttp, url: string, limites: LimitesPedido): Promise<ResultadoPedido> {
  return conPlazo(limites, async (senal): Promise<ResultadoPedido> => {
    const cuerpo = await pedirCuerpo(buscar, url, limites, senal, null);
    if (!cuerpo.ok) return cuerpo;
    try {
      return { ok: true, datos: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(cuerpo.bytes)) as unknown };
    } catch {
      return fallo(limites.prefijo, "FORMATO");
    }
  });
}

/**
 * Pide `url` y devuelve los bytes del cuerpo tal cual (sin decodificar), todo dentro de `tiempoMaximoMs`. El
 * content-type tiene que estar en `tiposAceptados` (si no, `<PREFIJO>_TIPO`, sin leer el cuerpo). Un cuerpo ausente o
 * vacío es `<PREFIJO>_FORMATO`. No lanza. Lo que se haga con los bytes (XML, zip) lo validan sus lectores acotados.
 */
export async function pedirBytesAcotado(buscar: BuscarHttp, url: string, limites: LimitesPedidoBytes): Promise<ResultadoBytes> {
  return conPlazo(limites, async (senal): Promise<ResultadoBytes> => {
    const cuerpo = await pedirCuerpo(buscar, url, limites, senal, limites.tiposAceptados);
    return cuerpo.ok && cuerpo.bytes.byteLength === 0 ? fallo(limites.prefijo, "FORMATO") : cuerpo;
  });
}
