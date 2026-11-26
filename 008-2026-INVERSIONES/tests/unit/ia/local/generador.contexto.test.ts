/**
 * El control de contexto de la puerta local (T7), con un `fetch` falso: un pedido que no cabe en `num_ctx` falla con
 * ERROR_PROVEEDOR CONTEXTO_LLENO SIN tocar la red y sin reintento; una generación que reporta entrada más salida igual o
 * mayor que el contexto falla igual (una sola generación, sin reintento); por debajo del límite, todo sigue igual.
 */
import { describe, expect, it, vi } from "vitest";
import { armarPedido } from "@/ia/generador";
import { NUM_CTX_LOCAL } from "@/ia/local/ollama";
import { crearGeneradorLocal } from "@/ia/local/generador";
import { construirPaquete } from "@/ia/paquete";
import { entradaDiario } from "../apoyo/hechos.ficticio";
import { ESQUEMA_FICTICIO, LIMITE_FICTICIO_MS, PROMPT_FICTICIO } from "../apoyo/pedido.ficticio";
import { crearOllamaFalso, generacionFicticia, guionFeliz, vigilarFalsos } from "./apoyo/ollama-falso";
import { CONFIG_FICTICIA, pedidoFicticio } from "./apoyo/red.ficticio";

vi.mock("@/ia/local/modelos", async (original) => {
  const real = await original<typeof import("@/ia/local/modelos")>();
  const { modeloAprobadoFicticio } = await import("./apoyo/red.ficticio");
  return { ...real, modeloAprobado: modeloAprobadoFicticio };
});

vigilarFalsos();

const vivo = (): AbortSignal => new AbortController().signal;

function conPromptDe(caracteres: number) {
  const paquete = construirPaquete(entradaDiario());
  return armarPedido({ paquete, prompt: { ...PROMPT_FICTICIO, texto: "palabra ".repeat(Math.ceil(caracteres / 8)) }, esquemaSalida: ESQUEMA_FICTICIO, limiteMs: LIMITE_FICTICIO_MS });
}

describe("antes de llamar: el pedido no cabe", () => {
  it("falla con CONTEXTO_LLENO, sin ninguna llamada a la red", async () => {
    const falso = crearOllamaFalso(guionFeliz());
    const local = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch });
    const r = await local.generar(conPromptDe(30_000), vivo());
    expect(r).toMatchObject({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "CONTEXTO_LLENO" });
    expect(falso.llamadas()).toEqual([]);
  });

  it("un pedido que cabe sigue su camino: tags y generar", async () => {
    const falso = crearOllamaFalso(guionFeliz());
    const local = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch });
    const r = await local.generar(pedidoFicticio().pedido, vivo());
    expect(r.ok).toBe(true);
    expect(falso.llamadas()).toHaveLength(2);
  });
});

describe("después de generar: el contexto se llenó", () => {
  const conTokens = (entrada: number, salida: number) => guionFeliz(generacionFicticia({ prompt_eval_count: entrada, eval_count: salida }));

  it("entrada más salida igual al contexto: CONTEXTO_LLENO, una sola generación (sin reintento)", async () => {
    const falso = crearOllamaFalso(conTokens(7000, NUM_CTX_LOCAL - 7000));
    const local = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch });
    const r = await local.generar(pedidoFicticio().pedido, vivo());
    expect(r).toMatchObject({ ok: false, motivo: "ERROR_PROVEEDOR", detalle: "CONTEXTO_LLENO" });
    expect(falso.llamadas().filter((l) => l.method === "POST")).toHaveLength(1);
  });

  it("también cuando la salida llegó cortada por largo: la causa es el contexto", async () => {
    const falso = crearOllamaFalso(guionFeliz(generacionFicticia({ prompt_eval_count: 8000, eval_count: 400, done_reason: "length" })));
    const local = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch });
    const r = await local.generar(pedidoFicticio().pedido, vivo());
    expect(r).toMatchObject({ ok: false, detalle: "CONTEXTO_LLENO" });
  });

  it("un token por debajo del contexto: publica con sus conteos", async () => {
    const falso = crearOllamaFalso(conTokens(7000, NUM_CTX_LOCAL - 7000 - 1));
    const local = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch });
    const r = await local.generar(pedidoFicticio().pedido, vivo());
    expect(r).toMatchObject({ ok: true, tokensEntrada: 7000, tokensSalida: NUM_CTX_LOCAL - 7000 - 1 });
  });

  it("sin conteos en la respuesta no se puede decir que se llenó: sigue como antes", async () => {
    const falso = crearOllamaFalso(guionFeliz(generacionFicticia({ prompt_eval_count: undefined, eval_count: undefined })));
    const local = crearGeneradorLocal(CONFIG_FICTICIA, { fetch: falso.fetch });
    const r = await local.generar(pedidoFicticio().pedido, vivo());
    expect(r).toMatchObject({ ok: true, tokensEntrada: null, tokensSalida: null });
  });
});
