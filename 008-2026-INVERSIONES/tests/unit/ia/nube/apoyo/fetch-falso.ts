/**
 * `fetch` falso, sin red: responde, falla, rechaza la conexión o se cuelga (antes de las cabeceras o en mitad del
 * cuerpo) según el guion, y respeta la señal del pedido en la espera y en la lectura del cuerpo, como `fetch` de Node.
 * Anota cada llamada con la URL, el método, las cabeceras, el cuerpo, `redirect` y la señal que recibió.
 */
export type ConductaFetch =
  | { readonly tipo: "JSON"; readonly estado?: number; readonly cuerpo: unknown; readonly cabeceras?: Readonly<Record<string, string>> }
  | { readonly tipo: "TEXTO"; readonly estado?: number; readonly texto: string; readonly cabeceras?: Readonly<Record<string, string>> }
  | { readonly tipo: "BYTES"; readonly n: number }
  | { readonly tipo: "RECHAZAR" }
  | { readonly tipo: "COLGAR" }
  | { readonly tipo: "COLGAR_CUERPO" };

export interface LlamadaFetch {
  readonly url: string;
  readonly metodo: string | undefined;
  readonly cabeceras: Readonly<Record<string, string>>;
  readonly cuerpo: string | undefined;
  readonly redirect: string | undefined;
  readonly senal: AbortSignal | undefined;
}

export interface FetchFalso {
  readonly fetch: typeof fetch;
  llamadas(): readonly LlamadaFetch[];
}

const errorAbortado = (): DOMException => new DOMException("This operation was aborted", "AbortError");

function cabecerasDe(init: RequestInit | undefined): Record<string, string> {
  return Object.fromEntries(new Headers(init?.headers).entries());
}

function respuestaColgada(senal: AbortSignal | undefined): Response {
  const cuerpo = new ReadableStream<Uint8Array>({
    start(control) {
      control.enqueue(new TextEncoder().encode('{"type":'));
      senal?.addEventListener("abort", () => control.error(errorAbortado()), { once: true });
    },
  });
  return new Response(cuerpo, { status: 200, headers: { "content-type": "application/json" } });
}

function responder(conducta: ConductaFetch, senal: AbortSignal | undefined): Promise<Response> {
  switch (conducta.tipo) {
    case "JSON":
      return Promise.resolve(new Response(JSON.stringify(conducta.cuerpo), { status: conducta.estado ?? 200, headers: { "content-type": "application/json", "request-id": "req_ficticio_alfa", ...conducta.cabeceras } }));
    case "TEXTO":
      return Promise.resolve(new Response(conducta.texto, { status: conducta.estado ?? 200, headers: { "content-type": "text/plain", ...conducta.cabeceras } }));
    case "BYTES":
      return Promise.resolve(new Response(new Uint8Array(conducta.n).fill(0x7b), { status: 200, headers: { "content-type": "application/json" } }));
    case "RECHAZAR":
      return Promise.reject(new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED") }));
    case "COLGAR":
      return new Promise((_resolver, rechazar) => {
        if (senal?.aborted) rechazar(errorAbortado());
        senal?.addEventListener("abort", () => rechazar(errorAbortado()), { once: true });
      });
    case "COLGAR_CUERPO":
      return Promise.resolve(respuestaColgada(senal));
  }
}

export function crearFetchFalso(guion: ConductaFetch | ((indice: number) => ConductaFetch)): FetchFalso {
  const llamadas: LlamadaFetch[] = [];
  const falso = (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const indice = llamadas.length;
    const senal = init?.signal ?? undefined;
    llamadas.push({
      url: String(entrada),
      metodo: init?.method,
      cabeceras: cabecerasDe(init),
      cuerpo: typeof init?.body === "string" ? init.body : undefined,
      redirect: init?.redirect,
      senal,
    });
    if (senal?.aborted) return Promise.reject(errorAbortado());
    return responder(typeof guion === "function" ? guion(indice) : guion, senal);
  };
  return { fetch: falso as typeof fetch, llamadas: () => Object.freeze([...llamadas]) };
}

/** Prohíbe la red de verdad durante la prueba: cualquier `fetch` global lanza. */
export function fetchProhibido(): typeof fetch {
  return (() => {
    throw new Error("red prohibida en las pruebas");
  }) as unknown as typeof fetch;
}
