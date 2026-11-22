/**
 * El transporte que el SDK usa como `fetch`: un solo destino (POST a la API de mensajes), una lista cerrada de
 * cabeceras (las que el entorno pueda colar, como ANTHROPIC_CUSTOM_HEADERS, no salen), sin seguir redirecciones, y el
 * cuerpo de la respuesta leído DENTRO del fetch con un tope de bytes (así el tiempo del SDK cubre también la lectura y
 * nada se lee entero sin límite). Sin red: la base es un fetch falso.
 */
import { describe, expect, it, vi } from "vitest";
import {
  CABECERAS_PERMITIDAS_NUBE, ErrorTransporteNube, MAX_BYTES_RESPUESTA_NUBE, URL_BASE_NUBE, URL_MENSAJES_NUBE, envolverFetch,
} from "@/ia/nube/transporte";
import { LlaveNube } from "@/ia/nube/config";
import { LLAVE_FICTICIA, OTRA_LLAVE_FICTICIA } from "./apoyo/datos.ficticio";
import { crearFetchFalso } from "./apoyo/fetch-falso";

const LLAVE = LlaveNube.desdeTexto(LLAVE_FICTICIA) as LlaveNube;

const CUERPO = '{"model":"claude-opus-5-5"}';
const init = (cambios: RequestInit = {}): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: CUERPO, ...cambios });

async function codigoDe(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
  } catch (e) {
    if (e instanceof ErrorTransporteNube) return e.codigo;
    throw e;
  }
  throw new Error("no rechazó");
}

describe("constantes del transporte", () => {
  it("el destino fijo, el tope de bytes y las cabeceras permitidas", () => {
    expect(URL_BASE_NUBE).toBe("https://api.anthropic.com");
    expect(URL_MENSAJES_NUBE).toBe("https://api.anthropic.com/v1/messages");
    expect(MAX_BYTES_RESPUESTA_NUBE).toBe(1_048_576);
    expect([...CABECERAS_PERMITIDAS_NUBE]).toEqual(["accept", "anthropic-version", "authorization", "content-type", "user-agent"]);
    expect(Object.isFrozen(CABECERAS_PERMITIDAS_NUBE)).toBe(true);
  });

  it("el mensaje del error es solo su código", () => {
    const error = new ErrorTransporteNube("DESTINO_NO_PERMITIDO");
    expect(error.message).toBe("Transporte de la nube: DESTINO_NO_PERMITIDO.");
    expect(error.name).toBe("ErrorTransporteNube");
  });
});

describe("envolverFetch · lo que sale", () => {
  it("solo las cabeceras permitidas, la llave propia en authorization (la que traiga el pedido se descarta), POST, sin redirecciones, el mismo cuerpo y la misma señal", async () => {
    const base = crearFetchFalso({ tipo: "JSON", cuerpo: { ok: true } });
    const control = new AbortController();
    const cabeceras = {
      accept: "application/json",
      "anthropic-version": "2026-10-21",
      authorization: `Bearer ${OTRA_LLAVE_FICTICIA}`,
      "content-type": "application/json",
      "user-agent": "Anthropic/JS ficticio",
      "x-ficticia": "si",
      "x-stainless-os": "MacOS",
      "x-api-key": "otra-llave-ficticia",
      "anthropic-beta": "beta-ficticia",
    };
    await envolverFetch(base.fetch, LLAVE)(URL_MENSAJES_NUBE, init({ headers: cabeceras, signal: control.signal, redirect: "follow" }));
    const [llamada] = base.llamadas();
    expect(llamada?.url).toBe(URL_MENSAJES_NUBE);
    expect(llamada?.metodo).toBe("POST");
    expect(llamada?.redirect).toBe("error");
    expect(llamada?.cuerpo).toBe(CUERPO);
    expect(llamada?.senal).toBe(control.signal);
    expect(llamada?.cabeceras).toEqual({
      accept: "application/json",
      "anthropic-version": "2026-10-21",
      authorization: `Bearer ${LLAVE_FICTICIA}`,
      "content-type": "application/json",
      "user-agent": "Anthropic/JS ficticio",
    });
  });

  it("sin authorization en el pedido, la pone igual desde la llave propia", async () => {
    const base = crearFetchFalso({ tipo: "JSON", cuerpo: {} });
    await envolverFetch(base.fetch, LLAVE)(URL_MENSAJES_NUBE, init());
    expect(base.llamadas()[0]?.cabeceras.authorization).toBe(`Bearer ${LLAVE_FICTICIA}`);
  });

  it("un POST sin cuerpo ni señal sale sin cuerpo", async () => {
    const base = crearFetchFalso({ tipo: "JSON", cuerpo: {} });
    await envolverFetch(base.fetch, LLAVE)(URL_MENSAJES_NUBE, { method: "POST" });
    expect(base.llamadas()[0]?.cuerpo).toBeUndefined();
    expect(base.llamadas()[0]?.senal).toBeUndefined();
  });

  it("acepta el destino como URL", async () => {
    const base = crearFetchFalso({ tipo: "JSON", cuerpo: {} });
    await envolverFetch(base.fetch, LLAVE)(new URL(URL_MENSAJES_NUBE), init());
    expect(base.llamadas()).toHaveLength(1);
  });

  it.each([
    ["otro host", "https://ficticio.invalid/v1/messages", init()],
    ["otro esquema", "http://api.anthropic.com/v1/messages", init()],
    ["otra ruta", "https://api.anthropic.com/v1/messages/batches", init()],
    ["con query", "https://api.anthropic.com/v1/messages?beta=true", init()],
    ["con fragmento", "https://api.anthropic.com/v1/messages#x", init()],
    ["con credenciales en la URL", "https://ficticio:clave@api.anthropic.com/v1/messages", init()],
    ["otro método", URL_MENSAJES_NUBE, init({ method: "GET" })],
    ["sin método", URL_MENSAJES_NUBE, { body: CUERPO }],
    ["una URL inválida", "no es una url", init()],
  ])("DESTINO_NO_PERMITIDO: %s, sin llamar a la base", async (_caso, destino, opciones) => {
    const base = crearFetchFalso({ tipo: "JSON", cuerpo: {} });
    expect(await codigoDe(envolverFetch(base.fetch, LLAVE)(destino, opciones))).toBe("DESTINO_NO_PERMITIDO");
    expect(base.llamadas()).toHaveLength(0);
  });

  it("DESTINO_NO_PERMITIDO: un Request en lugar de una URL", async () => {
    const base = crearFetchFalso({ tipo: "JSON", cuerpo: {} });
    expect(await codigoDe(envolverFetch(base.fetch, LLAVE)(new Request(URL_MENSAJES_NUBE, { method: "POST" }), init()))).toBe("DESTINO_NO_PERMITIDO");
    expect(base.llamadas()).toHaveLength(0);
  });
});

describe("envolverFetch · lo que vuelve", () => {
  it("una respuesta de exactamente el tope sale con su estado, sus cabeceras y su cuerpo", async () => {
    const base = crearFetchFalso({ tipo: "BYTES", n: MAX_BYTES_RESPUESTA_NUBE });
    const respuesta = await envolverFetch(base.fetch, LLAVE)(URL_MENSAJES_NUBE, init());
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-type")).toBe("application/json");
    expect((await respuesta.arrayBuffer()).byteLength).toBe(MAX_BYTES_RESPUESTA_NUBE);
  });

  it("una respuesta de error pasa con su estado y su cuerpo (la traduce el SDK)", async () => {
    const base = crearFetchFalso({ tipo: "JSON", estado: 529, cuerpo: { type: "error" }, cabeceras: { "x-should-retry": "true" } });
    const respuesta = await envolverFetch(base.fetch, LLAVE)(URL_MENSAJES_NUBE, init());
    expect(respuesta.status).toBe(529);
    expect(respuesta.headers.get("x-should-retry")).toBe("true");
    expect(await respuesta.json()).toEqual({ type: "error" });
  });

  it("un byte más que el tope: RESPUESTA_DEMASIADO_GRANDE y se cancela la lectura", async () => {
    const cancelar = vi.fn();
    const trozo = new Uint8Array(4613).fill(0x7b);
    let enviados = 0;
    const cuerpo = new ReadableStream<Uint8Array>({
      // Un cuerpo sin fin: solo la cancelación lo para.
      pull(control) {
        enviados += trozo.byteLength;
        control.enqueue(trozo);
      },
      cancel: cancelar,
    });
    const base = (() => Promise.resolve(new Response(cuerpo, { status: 200 }))) as unknown as typeof fetch;
    expect(await codigoDe(envolverFetch(base, LLAVE)(URL_MENSAJES_NUBE, init()))).toBe("RESPUESTA_DEMASIADO_GRANDE");
    expect(cancelar).toHaveBeenCalledTimes(1);
    expect(enviados).toBeLessThanOrEqual(MAX_BYTES_RESPUESTA_NUBE + 2 * trozo.byteLength);
  });

  it("un cuerpo nulo da una respuesta vacía", async () => {
    const base = (() => Promise.resolve(new Response(null, { status: 200 }))) as unknown as typeof fetch;
    const respuesta = await envolverFetch(base, LLAVE)(URL_MENSAJES_NUBE, init());
    expect(await respuesta.text()).toBe("");
  });

  it("si la señal se aborta antes de las cabeceras, rechaza", async () => {
    const base = crearFetchFalso({ tipo: "COLGAR" });
    const control = new AbortController();
    const promesa = envolverFetch(base.fetch, LLAVE)(URL_MENSAJES_NUBE, init({ signal: control.signal }));
    control.abort();
    await expect(promesa).rejects.toMatchObject({ name: "AbortError" });
  });

  it("si la señal se aborta en mitad del cuerpo, rechaza (la lectura está dentro del fetch)", async () => {
    const base = crearFetchFalso({ tipo: "COLGAR_CUERPO" });
    const control = new AbortController();
    const promesa = envolverFetch(base.fetch, LLAVE)(URL_MENSAJES_NUBE, init({ signal: control.signal }));
    setTimeout(() => control.abort(), 5);
    await expect(promesa).rejects.toMatchObject({ name: "AbortError" });
  });
});
