/**
 * Pedido HTTP de JSON con topes, común a las fuentes externas (Yahoo y SFC).
 * - No sigue redirecciones (`redirect: "error"`).
 * - Plazo total (pedido + cuerpo) con reloj propio: vale aunque `buscar` o el flujo ignoren la señal.
 * - Tope de bytes del cuerpo: rechaza por el content-length declarado y corta el flujo si lo pasa.
 * - UTF-8 estricto y JSON.
 * - Nunca lanza: los fallos vuelven como `<PREFIJO>_RED`, `<PREFIJO>_HTTP_<estado>` o `<PREFIJO>_FORMATO`.
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

export type ResultadoPedido = { readonly ok: true; readonly datos: unknown } | { readonly ok: false; readonly codigo: string };

type Falla = "RED" | "FORMATO";
type Lectura = { readonly ok: true; readonly texto: string } | { readonly ok: false; readonly falla: Falla };

const fallo = (prefijo: string, falla: Falla): ResultadoPedido => ({ ok: false, codigo: `${prefijo}_${falla}` });

/** Lee el cuerpo con tope de bytes: rechaza por el content-length declarado y corta el flujo si lo pasa. */
async function leerCuerpoAcotado(respuesta: RespuestaHttp, bytesMaximos: number, senal: AbortSignal): Promise<Lectura> {
  const declarado = Number(respuesta.headers.get("content-length"));
  if (declarado > bytesMaximos || !respuesta.body) return { ok: false, falla: "FORMATO" };
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
  try {
    return { ok: true, texto: new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(partes)) };
  } catch {
    return { ok: false, falla: "FORMATO" };
  }
}

/** Pedido y lectura, sin plazo propio: la señal la pone `pedirJsonAcotado`. No lanza. */
async function pedir(buscar: BuscarHttp, url: string, limites: LimitesPedido, senal: AbortSignal): Promise<ResultadoPedido> {
  let respuesta: RespuestaHttp;
  try {
    respuesta = await buscar(url, { headers: limites.headers, signal: senal, redirect: "error" });
  } catch {
    return fallo(limites.prefijo, "RED");
  }
  if (!respuesta.ok) return { ok: false, codigo: `${limites.prefijo}_HTTP_${respuesta.status}` };
  const cuerpo = await leerCuerpoAcotado(respuesta, limites.bytesMaximos, senal);
  if (!cuerpo.ok) return fallo(limites.prefijo, cuerpo.falla);
  try {
    return { ok: true, datos: JSON.parse(cuerpo.texto) as unknown };
  } catch {
    return fallo(limites.prefijo, "FORMATO");
  }
}

/**
 * Pide `url` y devuelve el JSON del cuerpo, todo dentro de `tiempoMaximoMs`. Al vencer el plazo se aborta
 * la señal (que corta `fetch` y su cuerpo) y se responde `<PREFIJO>_RED` sin esperar más. No lanza.
 */
export async function pedirJsonAcotado(buscar: BuscarHttp, url: string, limites: LimitesPedido): Promise<ResultadoPedido> {
  const controlador = new AbortController();
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const vencido = new Promise<ResultadoPedido>((resolver) => {
    reloj = setTimeout(() => {
      controlador.abort();
      resolver(fallo(limites.prefijo, "RED"));
    }, limites.tiempoMaximoMs);
  });
  try {
    return await Promise.race([pedir(buscar, url, limites, controlador.signal), vencido]);
  } catch {
    return fallo(limites.prefijo, "RED");
  } finally {
    clearTimeout(reloj);
  }
}
