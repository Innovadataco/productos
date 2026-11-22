/**
 * La lectura de una respuesta 200 de la API. Toda respuesta con `usage` válido se factura: vuelve como éxito con sus
 * tokens (para que el registro los cuente en el tope), y su salida es el texto del modelo SOLO si terminó bien
 * (`end_turn`, solo bloques de texto o de pensamiento, texto bien formado y dentro del tope). Si no, la salida va vacía
 * y el validador la rechaza. Sin `usage` válido no hay nada que contar: ERROR_PROVEEDOR.
 */
import { describe, expect, it } from "vitest";
import { MAX_SALIDA_CRUDA } from "@/ia/generador";
import { crearGeneradorFalso } from "@/ia/generador-falso";
import { MODELO_NUBE } from "@/ia/nube/peticion";
import { leerRespuesta } from "@/ia/nube/respuesta";
import { generarConPuertas } from "@/ia/puertas";
import { SALIDA_FICTICIA, mensajeFicticio, pedidoFicticio } from "./apoyo/datos.ficticio";

const LATENCIA = 317;
const usoCon = (cambios: Readonly<Record<string, unknown>>): Record<string, unknown> => ({ ...(mensajeFicticio().usage as Record<string, unknown>), ...cambios });

describe("leerRespuesta · éxito", () => {
  it("el texto, el modelo pedido, el model de la respuesta como digest y los tokens de usage", () => {
    const resultado = leerRespuesta(mensajeFicticio(), LATENCIA);
    expect(resultado).toEqual({
      ok: true,
      puerta: "nube",
      salidaCruda: SALIDA_FICTICIA,
      modelo: MODELO_NUBE,
      modeloDigest: "claude-opus-5-5",
      latenciaMs: LATENCIA,
      tokensEntrada: 4613 + 37 + 911,
      tokensSalida: 379,
    });
    expect(Object.isFrozen(resultado)).toBe(true);
  });

  it("el digest es el model que devolvió la API aunque no sea el pedido", () => {
    const resultado = leerRespuesta(mensajeFicticio({ model: "claude-opus-5-5-ficticio" }), LATENCIA);
    expect(resultado).toMatchObject({ ok: true, modelo: MODELO_NUBE, modeloDigest: "claude-opus-5-5-ficticio" });
  });

  it("une los bloques de texto en orden e ignora los de pensamiento", () => {
    const content = [
      { type: "text", text: '{"frases":', citations: null },
      { type: "redacted_thinking", data: "ficticio" },
      { type: "thinking", thinking: "", signature: "firma-ficticia" },
      { type: "text", text: "[]}", citations: null },
    ];
    expect(leerRespuesta(mensajeFicticio({ content }), LATENCIA)).toMatchObject({ ok: true, salidaCruda: '{"frases":[]}' });
  });

  it("los tokens de caché nulos o ausentes cuentan cero", () => {
    expect(leerRespuesta(mensajeFicticio({ usage: usoCon({ cache_creation_input_tokens: null, cache_read_input_tokens: null }) }), LATENCIA)).toMatchObject({ tokensEntrada: 4613 });
    const { cache_creation_input_tokens: _a, cache_read_input_tokens: _b, ...sinCache } = usoCon({});
    expect(leerRespuesta(mensajeFicticio({ usage: sinCache }), LATENCIA)).toMatchObject({ tokensEntrada: 4613 });
  });

  it("una salida del largo máximo pasa entera", () => {
    const texto = "a".repeat(MAX_SALIDA_CRUDA);
    expect(leerRespuesta(mensajeFicticio({ content: [{ type: "text", text: texto }] }), LATENCIA)).toMatchObject({ ok: true, salidaCruda: texto });
  });

  it("una latencia negativa o no finita queda en cero", () => {
    expect(leerRespuesta(mensajeFicticio(), -7)).toMatchObject({ latenciaMs: 0 });
    expect(leerRespuesta(mensajeFicticio(), Number.NaN)).toMatchObject({ latenciaMs: 0 });
  });

  it("lo que devuelve pasa intacto por la normalización del orquestador", async () => {
    const { paquete, pedido } = pedidoFicticio();
    const exito = leerRespuesta(mensajeFicticio(), LATENCIA);
    const generador = crearGeneradorFalso({ puerta: "nube", conducta: { tipo: "DEVOLVER", resultado: exito } });
    const corrida = await generarConPuertas([generador], "nube", pedido, paquete);
    expect(corrida).toMatchObject({ estado: "EXITO", exito });
  });
});

describe("leerRespuesta · facturada pero inservible: salida vacía y los tokens contados", () => {
  it.each([
    ["rechazo del modelo", { stop_reason: "refusal", stop_details: { type: "refusal", category: null, explanation: null } }],
    ["cortada por max_tokens", { stop_reason: "max_tokens" }],
    ["sin ventana de contexto", { stop_reason: "model_context_window_exceeded" }],
    ["en pausa", { stop_reason: "pause_turn" }],
    ["sin stop_reason", { stop_reason: null }],
    ["con una herramienta", { content: [{ type: "tool_use", id: "toolu_ficticio", name: "x", input: {} }] }],
    ["con un bloque desconocido", { content: [{ type: "bloque_ficticio" }] }],
    ["con un texto que no es texto", { content: [{ type: "text", text: 4613 }] }],
    ["con un bloque que no es objeto", { content: ["texto"] }],
    ["con un sustituto suelto", { content: [{ type: "text", text: '{"frases":"\uD800"}' }] }],
    ["demasiado larga", { content: [{ type: "text", text: "a".repeat(MAX_SALIDA_CRUDA + 1) }] }],
    ["sin contenido en arreglo", { content: "texto" }],
  ])("%s", (_caso, cambios) => {
    expect(leerRespuesta(mensajeFicticio(cambios), LATENCIA)).toEqual({
      ok: true, puerta: "nube", salidaCruda: "", modelo: MODELO_NUBE, modeloDigest: "claude-opus-5-5", latenciaMs: LATENCIA, tokensEntrada: 5561, tokensSalida: 379,
    });
  });
});

describe("leerRespuesta · RESPUESTA_INVALIDA (sin forma de Message o sin usage válido)", () => {
  const trampas: string[] = [];
  const proxy = new Proxy(mensajeFicticio(), {
    get(objetivo, clave, receptor) {
      trampas.push(String(clave));
      return Reflect.get(objetivo, clave, receptor) as unknown;
    },
    getOwnPropertyDescriptor(objetivo, clave) {
      trampas.push(String(clave));
      return Reflect.getOwnPropertyDescriptor(objetivo, clave);
    },
  });

  it.each([
    ["undefined", undefined],
    ["un texto", "texto plano"],
    ["un arreglo", [mensajeFicticio()]],
    ["null", null],
    ["sin usage", mensajeFicticio({ usage: undefined })],
    ["usage nulo", mensajeFicticio({ usage: null })],
    ["entrada negativa", mensajeFicticio({ usage: usoCon({ input_tokens: -1 }) })],
    ["entrada con decimales", mensajeFicticio({ usage: usoCon({ input_tokens: 4613.5 }) })],
    ["salida NaN", mensajeFicticio({ usage: usoCon({ output_tokens: Number.NaN }) })],
    ["salida en texto", mensajeFicticio({ usage: usoCon({ output_tokens: "379" }) })],
    ["salida faltante", mensajeFicticio({ usage: usoCon({ output_tokens: undefined }) })],
    ["caché negativa", mensajeFicticio({ usage: usoCon({ cache_read_input_tokens: -3 }) })],
    ["entrada no segura", mensajeFicticio({ usage: usoCon({ input_tokens: Number.MAX_SAFE_INTEGER + 2 }) })],
    ["suma de entrada no segura", mensajeFicticio({ usage: usoCon({ input_tokens: Number.MAX_SAFE_INTEGER, cache_read_input_tokens: 7 }) })],
    ["otro tipo", mensajeFicticio({ type: "error" })],
    ["model con espacio", mensajeFicticio({ model: "claude opus" })],
    ["model vacío", mensajeFicticio({ model: "" })],
    ["model que no es texto", mensajeFicticio({ model: 4613 })],
    ["un Proxy", proxy],
  ])("%s", (_caso, crudo) => {
    expect(leerRespuesta(crudo, LATENCIA)).toEqual({ ok: false, puerta: "nube", motivo: "ERROR_PROVEEDOR", detalle: "RESPUESTA_INVALIDA" });
  });

  it("el Proxy se descarta sin ejecutar sus trampas", () => {
    expect(trampas).toEqual([]);
  });
});
