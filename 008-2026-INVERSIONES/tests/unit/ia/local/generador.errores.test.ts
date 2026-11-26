/**
 * Cada camino de error del generador local, en cada etapa (tags y generate), con un `fetch` falso. La tabla cubre
 * TODOS los detalles de la lista cerrada (si se agrega uno sin camino, esta prueba se pone roja) y ningún resultado
 * repite lo que dijo el proveedor.
 */
import { describe, expect, it, vi } from "vitest";
import type { ResultadoGeneracion } from "@/ia/generador";
import { DETALLES_LOCAL } from "@/ia/local/errores";
import { crearGeneradorLocal } from "@/ia/local/generador";
import { bytes, conexionRechazada, crearOllamaFalso, flujoVigilado, generacionFicticia, hostInalcanzable, json, respuestaCruda, tagsCon, tagsDelFicticio, vigilarFalsos, type RespuestaFalsa } from "./apoyo/ollama-falso";
import { CONFIG_FICTICIA, DIGEST_LOCAL_FICTICIO, MODELO_LOCAL_FICTICIO, MODELO_PENDIENTE_FICTICIO, ORIGEN_FICTICIO, OTRO_DIGEST_FICTICIO, pedidoFicticio } from "./apoyo/red.ficticio";

vi.mock("@/ia/local/modelos", async (original) => {
  const real = await original<typeof import("@/ia/local/modelos")>();
  const { modeloAprobadoFicticio } = await import("./apoyo/red.ficticio");
  return { ...real, modeloAprobado: modeloAprobadoFicticio };
});

vigilarFalsos();

const DATO_DEL_PROVEEDOR = "FICTICIA-ALFA 4613.27";
type Etapa = "TAGS" | "GENERAR";

/** Corre un pedido con la respuesta dada en la etapa dada (la otra etapa responde bien). */
async function enEtapa(etapa: Etapa, respuesta: RespuestaFalsa): Promise<{ resultado: ResultadoGeneracion; llamadas: number }> {
  const falso = crearOllamaFalso((_l, i) => {
    if (i === 0) return etapa === "TAGS" ? respuesta : json(tagsDelFicticio());
    return etapa === "GENERAR" ? respuesta : json(generacionFicticia());
  });
  const local = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch });
  const resultado = await local.generar(pedidoFicticio().pedido, new AbortController().signal);
  return { resultado, llamadas: falso.llamadas().length };
}

const errorHttp = (estado: number): RespuestaFalsa => ({ tipo: "TEXTO", texto: `{"error":"${DATO_DEL_PROVEEDOR}"}`, estado });

const COMUNES: ReadonlyArray<readonly [string, () => RespuestaFalsa, string, string]> = [
  ["conexión rechazada", () => ({ tipo: "RECHAZAR", error: conexionRechazada() }), "MODELO_NO_DISPONIBLE", "CONEXION_RECHAZADA"],
  ["host inalcanzable", () => ({ tipo: "RECHAZAR", error: hostInalcanzable() }), "MODELO_NO_DISPONIBLE", "FALLO_DE_RED"],
  ["fetch que lanza", () => ({ tipo: "LANZAR", error: new Error(DATO_DEL_PROVEEDOR) }), "ERROR_PROVEEDOR", "EXCEPCION_INTERNA"],
  ["un rechazo que no es de red", () => ({ tipo: "RECHAZAR", error: new Error(DATO_DEL_PROVEEDOR) }), "ERROR_PROVEEDOR", "EXCEPCION_INTERNA"],
  ["corte a mitad del cuerpo", () => ({ tipo: "FLUJO", flujo: flujoVigilado([bytes('{"a":')], "FALLAR").flujo }), "MODELO_NO_DISPONIBLE", "CONEXION_CORTADA"],
  ["redirección", () => errorHttp(307), "ERROR_PROVEEDOR", "HTTP_REDIRECCION"],
  ["prohibido (el proxy de la tailnet)", () => errorHttp(403), "ERROR_PROVEEDOR", "HTTP_PROHIBIDO"],
  ["no encontrado", () => errorHttp(404), "ERROR_PROVEEDOR", "HTTP_NO_ENCONTRADO"],
  ["otro 4xx", () => errorHttp(429), "ERROR_PROVEEDOR", "HTTP_ERROR_CLIENTE"],
  ["5xx", () => errorHttp(503), "ERROR_PROVEEDOR", "HTTP_ERROR_SERVIDOR"],
  ["estado inválido", () => ({ tipo: "CRUDA", respuesta: respuestaCruda(0, { ok: true }) }), "ERROR_PROVEEDOR", "HTTP_ESTADO_INVALIDO"],
  ["cuerpo demasiado grande", () => ({ tipo: "TEXTO", texto: "{}", encabezados: { "content-length": String(1_048_577) } }), "ERROR_PROVEEDOR", "CUERPO_DEMASIADO_GRANDE"],
  ["cuerpo que no es JSON", () => ({ tipo: "TEXTO", texto: DATO_DEL_PROVEEDOR }), "ERROR_PROVEEDOR", "CUERPO_INVALIDO"],
];

const DE_TAGS: ReadonlyArray<readonly [string, () => RespuestaFalsa, string, string]> = [
  ["el modelo no está", () => json(tagsCon([{ nombre: "otro-ficticio:1b", digest: DIGEST_LOCAL_FICTICIO }])), "MODELO_NO_DISPONIBLE", "MODELO_NO_ENCONTRADO"],
  ["el modelo está dos veces", () => json(tagsCon([{ nombre: MODELO_LOCAL_FICTICIO, digest: DIGEST_LOCAL_FICTICIO }, { nombre: MODELO_LOCAL_FICTICIO, digest: DIGEST_LOCAL_FICTICIO }])), "MODELO_NO_DISPONIBLE", "MODELO_AMBIGUO"],
  ["el digest cambió", () => json(tagsDelFicticio(OTRO_DIGEST_FICTICIO)), "MODELO_NO_DISPONIBLE", "DIGEST_NO_COINCIDE"],
  ["un tags sin models", () => json({ error: DATO_DEL_PROVEEDOR }), "ERROR_PROVEEDOR", "CUERPO_INVALIDO"],
];

const DE_GENERAR: ReadonlyArray<readonly [string, () => RespuestaFalsa, string, string]> = [
  ["otro modelo respondió", () => json(generacionFicticia({ model: "otro-ficticio:1b" })), "ERROR_PROVEEDOR", "MODELO_DISTINTO"],
  ["la generación no terminó", () => json(generacionFicticia({ done: false })), "ERROR_PROVEEDOR", "GENERACION_INCOMPLETA"],
  ["la salida se cortó por largo", () => json(generacionFicticia({ done_reason: "length" })), "ERROR_PROVEEDOR", "SALIDA_CORTADA"],
  ["entrada y salida llenan el contexto", () => json(generacionFicticia({ prompt_eval_count: 8000, eval_count: 192 })), "ERROR_PROVEEDOR", "CONTEXTO_LLENO"],
  ["sin salida", () => json(generacionFicticia({ response: "", thinking: "" })), "ERROR_PROVEEDOR", "RESPUESTA_VACIA"],
  ["una finalización inesperada", () => json(generacionFicticia({ done_reason: "unload" })), "ERROR_PROVEEDOR", "FINALIZACION_INESPERADA"],
  ["un pensamiento sin JSON", () => json(generacionFicticia({ response: "", thinking: DATO_DEL_PROVEEDOR })), "ERROR_PROVEEDOR", "PENSAMIENTO_SIN_JSON"],
  ["una salida demasiado larga", () => json(generacionFicticia({ response: "w".repeat(65_537) })), "ERROR_PROVEEDOR", "SALIDA_DEMASIADO_LARGA"],
];

const vistos = new Set<string>();

describe.each(["TAGS", "GENERAR"] as const)("errores comunes en la etapa %s", (etapa) => {
  it.each(COMUNES)("%s → %s %s", async (_n, respuesta, motivo, detalle) => {
    const { resultado, llamadas } = await enEtapa(etapa, respuesta());
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo, detalle });
    expect(llamadas).toBe(etapa === "TAGS" ? 1 : 2);
    expect(JSON.stringify(resultado)).not.toMatch(/FICTICIA|4613/);
    vistos.add(detalle);
  });
});

describe("errores propios de tags (generate no se llama)", () => {
  it.each(DE_TAGS)("%s → %s %s", async (_n, respuesta, motivo, detalle) => {
    const { resultado, llamadas } = await enEtapa("TAGS", respuesta());
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo, detalle });
    expect(llamadas).toBe(1);
    expect(JSON.stringify(resultado)).not.toMatch(/FICTICIA|4613/);
    vistos.add(detalle);
  });
});

describe("errores propios de generate", () => {
  it.each(DE_GENERAR)("%s → %s %s", async (_n, respuesta, motivo, detalle) => {
    const { resultado, llamadas } = await enEtapa("GENERAR", respuesta());
    expect(resultado).toEqual({ ok: false, puerta: "local", motivo, detalle });
    expect(llamadas).toBe(2);
    vistos.add(detalle);
  });
});

describe("errores antes de la red y de tiempo (con límites cortos y reales)", () => {
  const vivo = (): AbortSignal => new AbortController().signal;

  it("digest pendiente → DIGEST_POR_VERIFICAR", async () => {
    const falso = crearOllamaFalso(() => json(tagsDelFicticio()));
    const local = crearGeneradorLocal({ destino: ORIGEN_FICTICIO, modelo: MODELO_PENDIENTE_FICTICIO }, { fetch: falso.fetch });
    expect(await local.generar(pedidoFicticio().pedido, vivo())).toMatchObject({ motivo: "MODELO_NO_DISPONIBLE", detalle: "DIGEST_POR_VERIFICAR" });
    vistos.add("DIGEST_POR_VERIFICAR");
  });

  it("pedido inválido y pedido que no es ciego", async () => {
    const falso = crearOllamaFalso(() => json(tagsDelFicticio()));
    const local = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch });
    const { pedido } = pedidoFicticio();
    expect(await local.generar({ ...pedido, prompt: { ...pedido.prompt, hash: "f".repeat(64) } }, vivo())).toMatchObject({ detalle: "PEDIDO_INVALIDO" });
    const vista = { ...pedido.vista, hechos: [...pedido.vista.hechos, { ...pedido.vista.hechos[0], valor: "x" }] };
    expect(await local.generar({ ...pedido, vista } as typeof pedido, vivo())).toMatchObject({ detalle: "PEDIDO_NO_CIEGO" });
    expect(falso.llamadas()).toHaveLength(0);
    vistos.add("PEDIDO_INVALIDO").add("PEDIDO_NO_CIEGO");
  });

  it("señal abortada, límite del cliente y límite en la espera del turno", async () => {
    const falso = crearOllamaFalso(() => ({ tipo: "COLGAR" }));
    const local = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch });
    const control = new AbortController();
    control.abort();
    expect(await local.generar(pedidoFicticio().pedido, control.signal)).toMatchObject({ motivo: "TIEMPO_AGOTADO", detalle: "SENAL_ABORTADA" });
    const colgado = local.generar(pedidoFicticio(41).pedido, vivo());
    const enEspera = local.generar(pedidoFicticio(23).pedido, vivo());
    expect(await enEspera).toMatchObject({ motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_EN_ESPERA" });
    expect(await colgado).toMatchObject({ motivo: "TIEMPO_AGOTADO", detalle: "LIMITE_DEL_CLIENTE" });
    expect(falso.llamadas()).toHaveLength(1);
    vistos.add("SENAL_ABORTADA").add("LIMITE_EN_ESPERA").add("LIMITE_DEL_CLIENTE");
  });

  it("una excepción propia → EXCEPCION_INTERNA", async () => {
    const falso = crearOllamaFalso(() => json(tagsDelFicticio()));
    const local = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch, ahora: () => {
      throw new Error(DATO_DEL_PROVEEDOR);
    } });
    const resultado = await local.generar(pedidoFicticio().pedido, vivo());
    expect(resultado).toMatchObject({ motivo: "ERROR_PROVEEDOR", detalle: "EXCEPCION_INTERNA" });
    expect(JSON.stringify(resultado)).not.toMatch(/FICTICIA|4613/);
    vistos.add("EXCEPCION_INTERNA");
  });
});

describe("cobertura de la lista cerrada", () => {
  it("cada detalle de DETALLES_LOCAL tiene un camino probado por generar", () => {
    const todos = Object.values(DETALLES_LOCAL).flat();
    expect([...vistos].sort()).toEqual([...todos].sort());
  });
});
