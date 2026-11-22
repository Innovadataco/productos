/**
 * El SDK REAL (`@anthropic-ai/sdk`, versión exacta) con un `fetch` falso inyectado: lo que de verdad saldría por el
 * cable (URL, cabeceras, cuerpo), sin reintentos, el aborto y el tiempo, las clases de error reales y el aislamiento del
 * entorno (ninguna variable ANTHROPIC_* cambia el destino, la llave, las cabeceras ni el registro). Sin red ni llave
 * real: el fetch global está prohibido durante cada prueba.
 */
import { inspect } from "node:util";
import {
  APIConnectionError, APIConnectionTimeoutError, APIUserAbortError, InternalServerError, OverloadedError, RateLimitError,
} from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LlaveNube } from "@/ia/nube/config";
import { armarCuerpoNube, type CuerpoNube } from "@/ia/nube/peticion";
import { CABECERAS_PERMITIDAS_NUBE, URL_MENSAJES_NUBE, crearClienteAnthropic } from "@/ia/nube/transporte";
import { LLAVE_FICTICIA, OTRA_LLAVE_FICTICIA, cuerpoErrorFicticio, mensajeFicticio, pedidoFicticio } from "./apoyo/datos.ficticio";
import { crearFetchFalso, fetchProhibido, type ConductaFetch } from "./apoyo/fetch-falso";

const LLAVE = LlaveNube.desdeTexto(LLAVE_FICTICIA) as LlaveNube;
const LIMITE_MS = 4613;

function cuerpoYJson(): { readonly cuerpo: CuerpoNube; readonly json: string } {
  const armado = armarCuerpoNube(pedidoFicticio().pedido);
  if (!armado.ok) throw new Error(armado.detalle);
  return armado;
}

function preparar(guion: ConductaFetch | ((indice: number) => ConductaFetch)) {
  const falso = crearFetchFalso(guion);
  const cliente = crearClienteAnthropic({ llave: LLAVE, fetchBase: falso.fetch });
  const llamar = (senal: AbortSignal = new AbortController().signal, timeout = LIMITE_MS): Promise<unknown> =>
    Promise.resolve(cliente.messages.create(cuerpoYJson().cuerpo, { signal: senal, timeout, maxRetries: 0 }));
  return { falso, cliente, llamar };
}

const consolas = (): ReturnType<typeof vi.spyOn>[] => (["log", "info", "warn", "error", "debug"] as const).map((nivel) => vi.spyOn(console, nivel).mockImplementation(() => undefined));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchProhibido());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("el cable", () => {
  it("POST a la API de mensajes, con la llave propia como Bearer, la versión de la API y el cuerpo armado tal cual", async () => {
    const { falso, llamar } = preparar({ tipo: "JSON", cuerpo: mensajeFicticio() });
    const respuesta = await llamar();
    expect(respuesta).toMatchObject({ model: "claude-opus-5-5", usage: { input_tokens: 4613, output_tokens: 379 } });
    const [llamada] = falso.llamadas();
    expect(falso.llamadas()).toHaveLength(1);
    expect(llamada?.url).toBe(URL_MENSAJES_NUBE);
    expect(llamada?.metodo).toBe("POST");
    expect(llamada?.redirect).toBe("error");
    expect(llamada?.cuerpo).toBe(cuerpoYJson().json);
    const cabeceras = llamada?.cabeceras ?? {};
    expect(Object.keys(cabeceras).every((nombre) => (CABECERAS_PERMITIDAS_NUBE as readonly string[]).includes(nombre))).toBe(true);
    expect(cabeceras.authorization).toBe(`Bearer ${LLAVE_FICTICIA}`);
    expect(cabeceras["anthropic-version"]).toBe("2026-10-21");
    expect(cabeceras["content-type"]).toBe("application/json");
    expect(cabeceras["x-api-key"]).toBeUndefined();
  });

  it("la llave no está en el cuerpo ni en la URL, solo en authorization", async () => {
    const { falso, llamar } = preparar({ tipo: "JSON", cuerpo: mensajeFicticio() });
    await llamar();
    const [llamada] = falso.llamadas();
    expect(llamada?.cuerpo).not.toContain(LLAVE_FICTICIA);
    expect(llamada?.url).not.toContain(LLAVE_FICTICIA);
  });

  it("el cliente no muestra la llave en inspect (no queda en un campo público del SDK)", () => {
    const { cliente } = preparar({ tipo: "JSON", cuerpo: mensajeFicticio() });
    expect(inspect(cliente, { depth: 6, showHidden: true })).not.toContain(LLAVE_FICTICIA);
    expect((cliente as unknown as { apiKey: unknown }).apiKey).toBeNull();
  });
});

describe("el entorno no cambia nada", () => {
  it("con ANTHROPIC_* en el entorno: mismo destino, misma llave, sin cabeceras coladas y sin escribir en la consola", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", OTRA_LLAVE_FICTICIA);
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", OTRA_LLAVE_FICTICIA);
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://ficticio.invalid");
    vi.stubEnv("ANTHROPIC_CUSTOM_HEADERS", `authorization: Bearer ${OTRA_LLAVE_FICTICIA}\nx-ficticia: si`);
    vi.stubEnv("ANTHROPIC_LOG", "debug");
    vi.stubEnv("ANTHROPIC_PROFILE", "perfil-ficticio");
    vi.stubEnv("ANTHROPIC_WEBHOOK_SIGNING_KEY", OTRA_LLAVE_FICTICIA);
    const espias = consolas();
    const { falso, llamar } = preparar({ tipo: "JSON", cuerpo: mensajeFicticio() });
    await llamar();
    const [llamada] = falso.llamadas();
    expect(llamada?.url).toBe(URL_MENSAJES_NUBE);
    expect(llamada?.cabeceras.authorization).toBe(`Bearer ${LLAVE_FICTICIA}`);
    expect(llamada?.cabeceras["x-ficticia"]).toBeUndefined();
    expect(JSON.stringify(llamada?.cabeceras)).not.toContain(OTRA_LLAVE_FICTICIA);
    for (const espia of espias) expect(espia).not.toHaveBeenCalled();
  });
});

describe("sin reintentos: una sola llamada, aunque el servidor pida reintentar", () => {
  it.each([
    ["529 con x-should-retry", { tipo: "JSON", estado: 529, cuerpo: cuerpoErrorFicticio("overloaded_error"), cabeceras: { "x-should-retry": "true", "retry-after-ms": "1" } }, OverloadedError],
    ["429", { tipo: "JSON", estado: 429, cuerpo: cuerpoErrorFicticio("rate_limit_error"), cabeceras: { "retry-after-ms": "1" } }, RateLimitError],
    ["500", { tipo: "JSON", estado: 500, cuerpo: cuerpoErrorFicticio("api_error") }, InternalServerError],
    ["conexión rechazada", { tipo: "RECHAZAR" }, APIConnectionError],
  ] as const)("%s", async (_caso, conducta, clase) => {
    const { falso, llamar } = preparar(conducta as ConductaFetch);
    await expect(llamar()).rejects.toBeInstanceOf(clase);
    expect(falso.llamadas()).toHaveLength(1);
  });

  it("el 429 del límite de gasto de la cuenta trae su código", async () => {
    const { llamar } = preparar({ tipo: "JSON", estado: 429, cuerpo: cuerpoErrorFicticio("rate_limit_error", "enforced_spend_limit_reached") });
    await expect(llamar()).rejects.toMatchObject({ errorCode: "enforced_spend_limit_reached", status: 429 });
  });
});

describe("aborto y tiempo", () => {
  it("abortar antes de las cabeceras da APIUserAbortError", async () => {
    const { llamar } = preparar({ tipo: "COLGAR" });
    const control = new AbortController();
    const promesa = llamar(control.signal);
    setTimeout(() => control.abort(), 5);
    await expect(promesa).rejects.toBeInstanceOf(APIUserAbortError);
  });

  it("abortar en mitad del cuerpo también da APIUserAbortError (la lectura está dentro del fetch)", async () => {
    const { llamar } = preparar({ tipo: "COLGAR_CUERPO" });
    const control = new AbortController();
    const promesa = llamar(control.signal);
    setTimeout(() => control.abort(), 5);
    await expect(promesa).rejects.toBeInstanceOf(APIUserAbortError);
  });

  it("con la señal ya abortada no llega a llamar", async () => {
    const { falso, llamar } = preparar({ tipo: "JSON", cuerpo: mensajeFicticio() });
    await expect(llamar(AbortSignal.abort())).rejects.toBeInstanceOf(APIUserAbortError);
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("el tiempo del pedido corta un fetch colgado: APIConnectionTimeoutError", async () => {
    const { llamar } = preparar({ tipo: "COLGAR" });
    await expect(llamar(new AbortController().signal, 37)).rejects.toBeInstanceOf(APIConnectionTimeoutError);
  });

  it("el tiempo del pedido también corta un cuerpo colgado", async () => {
    const { llamar } = preparar({ tipo: "COLGAR_CUERPO" });
    await expect(llamar(new AbortController().signal, 37)).rejects.toBeInstanceOf(APIConnectionTimeoutError);
  });
});

describe("respuestas raras", () => {
  it("un 200 que no es JSON llega como texto (lo descarta leerRespuesta)", async () => {
    const { llamar } = preparar({ tipo: "TEXTO", texto: "texto ficticio" });
    expect(await llamar()).toBe("texto ficticio");
  });

  it("una respuesta más grande que el tope se corta como error de conexión con su causa", async () => {
    const { llamar } = preparar({ tipo: "BYTES", n: 1_048_577 });
    await expect(llamar()).rejects.toMatchObject({ cause: { codigo: "RESPUESTA_DEMASIADO_GRANDE" } });
  });
});
