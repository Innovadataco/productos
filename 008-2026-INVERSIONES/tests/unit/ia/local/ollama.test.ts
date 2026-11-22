/**
 * Lo propio de Ollama, puro: los cuerpos que se mandan (generate y smoke) y la lectura de lo que vuelve (tags y
 * generate). El modelo recibe SOLO la vista ciega y el texto del prompt; el respaldo de `thinking` es el de PI.
 */
import { describe, expect, it } from "vitest";
import { jsonCanonico } from "@/ia/hash";
import { KEEP_ALIVE_LOCAL, MAX_MODELOS_TAGS, OPCIONES_GENERACION, OPCIONES_SMOKE, PROMPT_SMOKE, cuerpoGenerar, cuerpoSmoke, leerGeneracion, verificarModelo } from "@/ia/local/ollama";
import { fugasEn, hayDigitosFueraDeIds } from "../apoyo/detectores";
import { ESQUEMA_FICTICIO, PROMPT_FICTICIO } from "../apoyo/pedido.ficticio";
import { generacionFicticia, tagsCon, tagsDelFicticio } from "./apoyo/ollama-falso";
import { DIGEST_LOCAL_FICTICIO, MODELO_LOCAL_FICTICIO, OTRO_DIGEST_FICTICIO, SALIDA_FICTICIA, pedidoFicticio } from "./apoyo/red.ficticio";

const APROBADO = Object.freeze({ nombre: MODELO_LOCAL_FICTICIO, digest: DIGEST_LOCAL_FICTICIO });
const falloProveedor = (detalle: string) => ({ ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle });
const falloModelo = (detalle: string) => ({ ok: false, puerta: "local", motivo: "MODELO_NO_DISPONIBLE", detalle });

describe("constantes del pedido", () => {
  it("temperatura 0, semilla 42 y keep_alive corto; el smoke, además, con pocos tokens", () => {
    expect(OPCIONES_GENERACION).toEqual({ temperature: 0, seed: 42 });
    expect(OPCIONES_SMOKE).toEqual({ temperature: 0, seed: 42, num_predict: 5 });
    expect(KEEP_ALIVE_LOCAL).toBe("30s");
    expect(PROMPT_SMOKE).toBe("Responda solo: ok");
    expect(Object.isFrozen(OPCIONES_GENERACION) && Object.isFrozen(OPCIONES_SMOKE)).toBe(true);
  });
});

describe("cuerpoGenerar", () => {
  it("lleva el modelo, el prompt como system, la vista ciega como prompt, el esquema como format, sin flujo", () => {
    const { pedido } = pedidoFicticio();
    const texto = cuerpoGenerar(MODELO_LOCAL_FICTICIO, pedido);
    expect(JSON.parse(texto)).toEqual({
      model: MODELO_LOCAL_FICTICIO,
      system: PROMPT_FICTICIO.texto,
      prompt: jsonCanonico(pedido.vista),
      format: ESQUEMA_FICTICIO,
      stream: false,
      options: { temperature: 0, seed: 42 },
      keep_alive: "30s",
    });
    expect(texto).toBe(jsonCanonico(JSON.parse(texto)));
  });

  it("no lleva el hash ni la versión del prompt, ni el límite", () => {
    const { pedido } = pedidoFicticio();
    const texto = cuerpoGenerar(MODELO_LOCAL_FICTICIO, pedido);
    expect(texto).not.toContain(pedido.prompt.hash);
    expect(texto).not.toContain(pedido.prompt.version);
    expect(texto).not.toContain(String(pedido.limiteMs));
  });

  it("lo que lee el modelo (system y prompt) no trae ningún dato del paquete ni dígitos fuera de los ids", () => {
    const { paquete, pedido } = pedidoFicticio();
    const { system, prompt } = JSON.parse(cuerpoGenerar(MODELO_LOCAL_FICTICIO, pedido)) as { system: string; prompt: string };
    expect(hayDigitosFueraDeIds(prompt)).toBe(false);
    expect(fugasEn(prompt, paquete)).toEqual([]);
    expect(fugasEn(JSON.stringify(system), paquete)).toEqual([]);
  });
});

describe("cuerpoSmoke", () => {
  it("una generación mínima, sin format ni system, con el mismo keep_alive", () => {
    const texto = cuerpoSmoke(MODELO_LOCAL_FICTICIO);
    expect(JSON.parse(texto)).toEqual({ model: MODELO_LOCAL_FICTICIO, prompt: "Responda solo: ok", stream: false, options: { temperature: 0, seed: 42, num_predict: 5 }, keep_alive: "30s" });
    expect(texto).toBe(jsonCanonico(JSON.parse(texto)));
  });
});

describe("verificarModelo · /api/tags", () => {
  it("el modelo está, con su digest: ok", () => {
    expect(verificarModelo(tagsDelFicticio(), APROBADO)).toEqual({ ok: true });
  });

  it("el digest con prefijo sha256: también vale (se compara el hex)", () => {
    expect(verificarModelo(tagsDelFicticio(`sha256:${DIGEST_LOCAL_FICTICIO}`), APROBADO)).toEqual({ ok: true });
  });

  it("basta con que coincida `model` (o `name`)", () => {
    const soloModel = { models: [{ model: MODELO_LOCAL_FICTICIO, digest: DIGEST_LOCAL_FICTICIO }] };
    const soloName = { models: [{ name: MODELO_LOCAL_FICTICIO, digest: DIGEST_LOCAL_FICTICIO }] };
    expect(verificarModelo(soloModel, APROBADO)).toEqual({ ok: true });
    expect(verificarModelo(soloName, APROBADO)).toEqual({ ok: true });
  });

  it.each([
    ["otro digest", tagsDelFicticio(OTRO_DIGEST_FICTICIO)],
    ["el digest en mayúsculas", tagsDelFicticio(DIGEST_LOCAL_FICTICIO.toUpperCase())],
    ["el digest recortado", tagsDelFicticio(DIGEST_LOCAL_FICTICIO.slice(0, 12))],
    ["otro prefijo", tagsDelFicticio(`sha512:${DIGEST_LOCAL_FICTICIO}`)],
    ["sin digest", { models: [{ name: MODELO_LOCAL_FICTICIO }] }],
    ["un digest que no es texto", { models: [{ name: MODELO_LOCAL_FICTICIO, digest: 4613 }] }],
  ])("%s → MODELO_NO_DISPONIBLE DIGEST_NO_COINCIDE", (_n, tags) => {
    expect(verificarModelo(tags, APROBADO)).toEqual(falloModelo("DIGEST_NO_COINCIDE"));
  });

  it.each([
    ["sin modelos", { models: [] }],
    ["otro modelo", tagsCon([{ nombre: "otro-ficticio:1b", digest: DIGEST_LOCAL_FICTICIO }])],
    ["el nombre sin la etiqueta", tagsCon([{ nombre: "ficticio-local", digest: DIGEST_LOCAL_FICTICIO }])],
    ["el nombre en mayúsculas", tagsCon([{ nombre: MODELO_LOCAL_FICTICIO.toUpperCase(), digest: DIGEST_LOCAL_FICTICIO }])],
    ["entradas que no son objetos", { models: [MODELO_LOCAL_FICTICIO, null, 7] }],
  ])("%s → MODELO_NO_DISPONIBLE MODELO_NO_ENCONTRADO", (_n, tags) => {
    expect(verificarModelo(tags, APROBADO)).toEqual(falloModelo("MODELO_NO_ENCONTRADO"));
  });

  it("dos entradas con el mismo nombre → MODELO_NO_DISPONIBLE MODELO_AMBIGUO (aunque una cuadre)", () => {
    const tags = tagsCon([{ nombre: MODELO_LOCAL_FICTICIO, digest: DIGEST_LOCAL_FICTICIO }, { nombre: MODELO_LOCAL_FICTICIO, digest: OTRO_DIGEST_FICTICIO }]);
    expect(verificarModelo(tags, APROBADO)).toEqual(falloModelo("MODELO_AMBIGUO"));
  });

  it.each([
    ["null", null],
    ["un arreglo", []],
    ["sin models", { modelos: [] }],
    ["models que no es arreglo", { models: { name: MODELO_LOCAL_FICTICIO } }],
    ["demasiadas entradas", { models: Array.from({ length: MAX_MODELOS_TAGS + 1 }, (_v, i) => ({ name: `relleno-ficticio-${String.fromCharCode(97 + (i % 26))}` })) }],
  ])("%s → ERROR_PROVEEDOR CUERPO_INVALIDO", (_n, tags) => {
    expect(verificarModelo(tags, APROBADO)).toEqual(falloProveedor("CUERPO_INVALIDO"));
  });

  it("el tope de entradas es 1024", () => {
    expect(MAX_MODELOS_TAGS).toBe(1024);
  });
});

describe("leerGeneracion · /api/generate", () => {
  it("lee la salida de `response` y los tokens", () => {
    expect(leerGeneracion(generacionFicticia(), MODELO_LOCAL_FICTICIO)).toEqual({
      ok: true,
      generacion: { salida: SALIDA_FICTICIA, tokensEntrada: 613, tokensSalida: 271, cortada: false },
    });
  });

  it.each([["vacía", ""], ["solo espacios", " \n\t "], ["ausente", undefined], ["que no es texto", 4613]])("con `response` %s toma `thinking` (como PI)", (_n, response) => {
    const datos = generacionFicticia({ response, thinking: SALIDA_FICTICIA });
    expect(leerGeneracion(datos, MODELO_LOCAL_FICTICIO)).toMatchObject({ ok: true, generacion: { salida: SALIDA_FICTICIA } });
  });

  it("con las dos, manda `response`", () => {
    const datos = generacionFicticia({ thinking: "otra cosa" });
    expect(leerGeneracion(datos, MODELO_LOCAL_FICTICIO)).toMatchObject({ ok: true, generacion: { salida: SALIDA_FICTICIA } });
  });

  it("la salida va tal cual, sin recortar", () => {
    const conEspacios = `  ${SALIDA_FICTICIA}\n`;
    expect(leerGeneracion(generacionFicticia({ response: conEspacios }), MODELO_LOCAL_FICTICIO)).toMatchObject({ ok: true, generacion: { salida: conEspacios } });
  });

  it.each([["vacías", "", ""], ["solo espacios", " ", "\n"], ["ausentes", undefined, undefined], ["que no son texto", 7, { a: 1 }]])("con `response` y `thinking` %s → ERROR_PROVEEDOR RESPUESTA_VACIA", (_n, response, thinking) => {
    expect(leerGeneracion(generacionFicticia({ response, thinking }), MODELO_LOCAL_FICTICIO)).toEqual(falloProveedor("RESPUESTA_VACIA"));
  });

  it("done_reason «length» se marca como cortada (lo decide quien llama)", () => {
    expect(leerGeneracion(generacionFicticia({ done_reason: "length" }), MODELO_LOCAL_FICTICIO)).toMatchObject({ ok: true, generacion: { cortada: true } });
  });

  it.each([["ausentes", undefined, undefined], ["negativos", -3, -1], ["con fracción", 61.3, 27.1], ["en texto", "613", "271"]])("tokens %s → null", (_n, entrada, salida) => {
    const datos = generacionFicticia({ prompt_eval_count: entrada, eval_count: salida });
    expect(leerGeneracion(datos, MODELO_LOCAL_FICTICIO)).toMatchObject({ ok: true, generacion: { tokensEntrada: null, tokensSalida: null } });
  });

  it.each([["otro modelo", "otro-ficticio:1b"], ["sin modelo", undefined], ["el nombre en mayúsculas", MODELO_LOCAL_FICTICIO.toUpperCase()]])("%s en la respuesta → ERROR_PROVEEDOR MODELO_DISTINTO", (_n, model) => {
    expect(leerGeneracion(generacionFicticia({ model }), MODELO_LOCAL_FICTICIO)).toEqual(falloProveedor("MODELO_DISTINTO"));
  });

  it.each([["false", false], ["ausente", undefined], ["en texto", "true"]])("done %s → ERROR_PROVEEDOR GENERACION_INCOMPLETA", (_n, done) => {
    expect(leerGeneracion(generacionFicticia({ done }), MODELO_LOCAL_FICTICIO)).toEqual(falloProveedor("GENERACION_INCOMPLETA"));
  });

  it.each([["null", null], ["un arreglo", [SALIDA_FICTICIA]], ["un texto", SALIDA_FICTICIA]])("un cuerpo %s → ERROR_PROVEEDOR CUERPO_INVALIDO", (_n, datos) => {
    expect(leerGeneracion(datos, MODELO_LOCAL_FICTICIO)).toEqual(falloProveedor("CUERPO_INVALIDO"));
  });
});
