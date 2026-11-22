/**
 * Las sondas de la puerta local, como las de PI: el ping (GET /api/tags: vive, y está el modelo aprobado con su digest)
 * y el smoke (POST /api/generate mínimo). El ping no toma el turno (no carga el modelo); el smoke sí. Con un `fetch`
 * falso y la lista de modelos ficticia.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorLocal, type CodigoErrorLocal } from "@/ia/local/errores";
import { crearGeneradorLocal, type OpcionesSonda } from "@/ia/local/generador";
import { conexionRechazada, crearOllamaFalso, diferido, generacionFicticia, json, tagsDelFicticio, vigilarFalsos, type Guion } from "./apoyo/ollama-falso";
import { CONFIG_FICTICIA, MODELO_LOCAL_FICTICIO, OTRO_DIGEST_FICTICIO, URL_GENERAR, URL_TAGS, pedidoFicticio } from "./apoyo/red.ficticio";

vi.mock("@/ia/local/modelos", async (original) => {
  const real = await original<typeof import("@/ia/local/modelos")>();
  const { modeloAprobadoFicticio } = await import("./apoyo/red.ficticio");
  return { ...real, modeloAprobado: modeloAprobadoFicticio };
});

vigilarFalsos();

afterEach(() => {
  vi.useRealTimers();
});

const LIMITE_MS = 4613;
const SMOKE = { response: "ok", thinking: "", done_reason: "length", eval_count: 5 };

function generador(guion: Guion, ahora: () => number = reloj(1237.5, 1250.25)) {
  const falso = crearOllamaFalso(guion);
  return { falso, local: crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch, ahora }) };
}

function reloj(...instantes: number[]): () => number {
  let i = 0;
  return () => instantes[Math.min(i++, instantes.length - 1)] as number;
}

async function codigoDe(accion: () => Promise<unknown>): Promise<CodigoErrorLocal> {
  try {
    await accion();
  } catch (e) {
    if (e instanceof ErrorLocal) return e.codigo;
    throw e;
  }
  throw new Error("no lanzó");
}

describe("sondaLocal · ping", () => {
  it("solo el ping: una consulta a tags, ok con la latencia del reloj", async () => {
    const { local, falso } = generador(() => json(tagsDelFicticio()));
    expect(await local.sondaLocal({ smoke: false, limiteMs: LIMITE_MS })).toEqual({ ok: true, smoke: "NO_PEDIDO", latenciaMs: 12.75 });
    expect(falso.llamadas().map((l) => [l.method, l.url])).toEqual([["GET", URL_TAGS]]);
  });

  it("Ollama apagado (conexión rechazada) → falla en el PING con MODELO_NO_DISPONIBLE", async () => {
    const { local } = generador(() => ({ tipo: "RECHAZAR", error: conexionRechazada() }));
    expect(await local.sondaLocal({ smoke: true, limiteMs: LIMITE_MS })).toEqual({ ok: false, etapa: "PING", motivo: "MODELO_NO_DISPONIBLE", detalle: "CONEXION_RECHAZADA", latenciaMs: 12.75 });
  });

  it("el digest cambió → falla en el PING y no hace el smoke", async () => {
    const { local, falso } = generador(() => json(tagsDelFicticio(OTRO_DIGEST_FICTICIO)));
    expect(await local.sondaLocal({ smoke: true, limiteMs: LIMITE_MS })).toMatchObject({ ok: false, etapa: "PING", motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_NO_COINCIDE" });
    expect(falso.llamadas()).toHaveLength(1);
  });

  it("con una señal viva del llamador, responde igual", async () => {
    const { local } = generador(() => json(tagsDelFicticio()));
    expect(await local.sondaLocal({ smoke: false, limiteMs: LIMITE_MS }, new AbortController().signal)).toMatchObject({ ok: true, smoke: "NO_PEDIDO" });
  });

  it("una señal ya abortada → PING TIEMPO_AGOTADO SENAL_ABORTADA, sin red", async () => {
    const { local, falso } = generador(() => json(tagsDelFicticio()));
    const control = new AbortController();
    control.abort();
    expect(await local.sondaLocal({ smoke: false, limiteMs: LIMITE_MS }, control.signal)).toEqual({ ok: false, etapa: "PING", motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA", latenciaMs: 0 });
    expect(falso.llamadas()).toHaveLength(0);
  });

  it("un tags colgado vence en el límite de la sonda → PING TIEMPO_AGOTADO LIMITE_DEL_CLIENTE", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { local } = generador(() => ({ tipo: "COLGAR" }));
    const espera = local.sondaLocal({ smoke: false, limiteMs: LIMITE_MS });
    await vi.advanceTimersByTimeAsync(LIMITE_MS);
    expect(await espera).toMatchObject({ ok: false, etapa: "PING", motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_DEL_CLIENTE" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("el ping no espera el turno: responde aunque una generación esté en curso", async () => {
    const generando = diferido<Response>();
    const { local, falso } = generador((_l, i) => (i === 1 ? { tipo: "PROMESA", promesa: generando.promesa } : json(tagsDelFicticio())));
    const enCurso = local.generar(pedidoFicticio().pedido, new AbortController().signal);
    await new Promise((r) => setTimeout(r, 7));
    expect(await local.sondaLocal({ smoke: false, limiteMs: LIMITE_MS })).toMatchObject({ ok: true, smoke: "NO_PEDIDO" });
    expect(falso.llamadas().map((l) => l.url)).toEqual([URL_TAGS, URL_GENERAR, URL_TAGS]);
    generando.resolver(new Response(JSON.stringify(generacionFicticia())));
    expect(await enCurso).toMatchObject({ ok: true });
  });
});

describe("sondaLocal · smoke", () => {
  it("ping y después una generación mínima: dos llamadas y ok", async () => {
    const { local, falso } = generador((_l, i) => json(i === 0 ? tagsDelFicticio() : generacionFicticia(SMOKE)));
    expect(await local.sondaLocal({ smoke: true, limiteMs: LIMITE_MS })).toEqual({ ok: true, smoke: "OK", latenciaMs: 12.75 });
    expect(falso.llamadas().map((l) => [l.method, l.url])).toEqual([["GET", URL_TAGS], ["POST", URL_GENERAR]]);
  });

  it("el cuerpo del smoke: el modelo, «Responda solo: ok», sin format ni system, pocos tokens y el mismo keep_alive", async () => {
    const { local, falso } = generador((_l, i) => json(i === 0 ? tagsDelFicticio() : generacionFicticia(SMOKE)));
    await local.sondaLocal({ smoke: true, limiteMs: LIMITE_MS });
    expect(JSON.parse(falso.llamadas()[1]?.body as string)).toEqual({
      model: MODELO_LOCAL_FICTICIO, prompt: "Responda solo: ok", stream: false, options: { temperature: 0, seed: 42, num_predict: 5 }, keep_alive: "30s",
    });
  });

  it("vale una respuesta que solo trae `thinking` (como PI)", async () => {
    const { local } = generador((_l, i) => json(i === 0 ? tagsDelFicticio() : generacionFicticia({ ...SMOKE, response: "", thinking: "ok" })));
    expect(await local.sondaLocal({ smoke: true, limiteMs: LIMITE_MS })).toMatchObject({ ok: true, smoke: "OK" });
  });

  it.each([
    ["un 500", json({ error: "FICTICIA" }, 500), "ERROR_PROVEEDOR", "HTTP_ERROR_SERVIDOR"],
    ["una respuesta vacía", json(generacionFicticia({ response: "", thinking: "" })), "ERROR_PROVEEDOR", "RESPUESTA_VACIA"],
    ["otro modelo", json(generacionFicticia({ ...SMOKE, model: "otro-ficticio:1b" })), "ERROR_PROVEEDOR", "MODELO_DISTINTO"],
    ["una finalización inesperada", json(generacionFicticia({ ...SMOKE, done_reason: "unload" })), "ERROR_PROVEEDOR", "FINALIZACION_INESPERADA"],
    ["la conexión rechazada", { tipo: "RECHAZAR", error: conexionRechazada() }, "MODELO_NO_DISPONIBLE", "CONEXION_RECHAZADA"],
  ] as const)("el smoke con %s falla en la etapa SMOKE: %s %s", async (_n, respuesta, motivo, detalle) => {
    const { local } = generador((_l, i) => (i === 0 ? json(tagsDelFicticio()) : respuesta));
    expect(await local.sondaLocal({ smoke: true, limiteMs: LIMITE_MS })).toEqual({ ok: false, etapa: "SMOKE", motivo, detalle, latenciaMs: 12.75 });
  });

  it("el smoke sí espera el turno: no genera hasta que termina la generación en curso", async () => {
    const generando = diferido<Response>();
    const { local, falso } = generador((_l, i) => {
      if (i === 1) return { tipo: "PROMESA", promesa: generando.promesa };
      return json(i === 3 ? generacionFicticia(SMOKE) : tagsDelFicticio());
    });
    const enCurso = local.generar(pedidoFicticio().pedido, new AbortController().signal);
    await new Promise((r) => setTimeout(r, 7));
    const sonda = local.sondaLocal({ smoke: true, limiteMs: LIMITE_MS });
    await new Promise((r) => setTimeout(r, 7));
    expect(falso.llamadas().map((l) => l.url)).toEqual([URL_TAGS, URL_GENERAR, URL_TAGS]);
    generando.resolver(new Response(JSON.stringify(generacionFicticia())));
    expect(await enCurso).toMatchObject({ ok: true });
    expect(await sonda).toMatchObject({ ok: true, smoke: "OK" });
    expect(falso.llamadas().map((l) => l.url)).toEqual([URL_TAGS, URL_GENERAR, URL_TAGS, URL_GENERAR]);
  });

  it("el smoke que vence esperando el turno → SMOKE TIEMPO_AGOTADO LIMITE_EN_ESPERA", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { local } = generador((_l, i) => (i === 1 ? { tipo: "COLGAR" } : json(tagsDelFicticio())));
    void local.generar(pedidoFicticio(37_911).pedido, new AbortController().signal);
    const sonda = local.sondaLocal({ smoke: true, limiteMs: LIMITE_MS });
    await vi.advanceTimersByTimeAsync(LIMITE_MS);
    expect(await sonda).toMatchObject({ ok: false, etapa: "SMOKE", motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_EN_ESPERA" });
    await vi.advanceTimersByTimeAsync(37_911);
  });

  it("nunca rechaza por un error propio: un reloj que lanza da EXCEPCION_INTERNA", async () => {
    const { local } = generador(() => json(tagsDelFicticio()), () => {
      throw new Error("reloj roto");
    });
    expect(await local.sondaLocal({ smoke: false, limiteMs: LIMITE_MS })).toEqual({ ok: false, etapa: "PING", motivo: "ERROR_PROVEEDOR", detalle: "EXCEPCION_INTERNA", latenciaMs: 0 });
  });
});

describe("sondaLocal · opciones (un error del código: rechaza con ErrorLocal)", () => {
  const { local } = generador(() => json(tagsDelFicticio()));
  it.each([
    ["límite cero", { smoke: false, limiteMs: 0 }, "LIMITE_INVALIDO"],
    ["límite con fracción", { smoke: false, limiteMs: 46.13 }, "LIMITE_INVALIDO"],
    ["límite de más", { smoke: false, limiteMs: 600_001 }, "LIMITE_INVALIDO"],
    ["sin límite", { smoke: false }, "LIMITE_INVALIDO"],
    ["smoke que no es booleano", { smoke: "si", limiteMs: LIMITE_MS }, "CONFIGURACION_INVALIDA"],
    ["un campo de más", { smoke: false, limiteMs: LIMITE_MS, modelo: "x" }, "CONFIGURACION_INVALIDA"],
    ["null", null, "CONFIGURACION_INVALIDA"],
  ])("%s → %s", async (_n, opciones, codigo) => {
    expect(await codigoDe(() => local.sondaLocal(opciones as OpcionesSonda))).toBe(codigo);
  });
});
