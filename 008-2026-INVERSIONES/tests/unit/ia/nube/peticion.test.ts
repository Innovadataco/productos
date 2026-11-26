/**
 * El cuerpo que sale hacia la API de Claude: el modelo fijo, `max_tokens`, el prompt versionado como `system`, la vista
 * ciega (y SOLO la vista) como contenido, pensamiento adaptativo con esfuerzo bajo y la salida estructurada con el
 * esquema del pedido en la forma estricta de la API. Sin parámetros de muestreo ni respaldos de otro modelo.
 *
 * Defensa en profundidad: aunque `generarConPuertas` ya pasó el pedido por su guarda, el cliente vuelve a revisarlo
 * antes de mandar nada a internet, y cierra en fallo sin lanzar.
 */
import { describe, expect, it } from "vitest";
import { TIPOS_DIARIOS } from "@/ia/contrato";
import type { PedidoGeneracion } from "@/ia/generador";
import { jsonCanonico } from "@/ia/hash";
import { ESFUERZO_NUBE, MAX_TOKENS_NUBE, MODELO_NUBE, armarCuerpoNube, vistaParaNube, type CuerpoArmado } from "@/ia/nube/peticion";
import { camposDeMas, fugasEn, hayDigitosFueraDeIds } from "../apoyo/detectores";
import { ESQUEMA_FICTICIO, LIMITE_FICTICIO_MS, PROMPT_FICTICIO } from "../apoyo/pedido.ficticio";
import { pedidoFicticio } from "./apoyo/datos.ficticio";

function armado(pedido: PedidoGeneracion): Extract<CuerpoArmado, { ok: true }> {
  const resultado = armarCuerpoNube(pedido);
  if (!resultado.ok) throw new Error(`no armó: ${resultado.detalle}`);
  return resultado;
}

const ESQUEMA_ESTRICTO = {
  type: "object",
  properties: { frases: { type: "array", description: "{maxItems: 6}" } },
  additionalProperties: false,
  required: ["frases"],
};

describe("constantes del pedido", () => {
  it("modelo fijo, max_tokens con holgura para el pensamiento y esfuerzo bajo", () => {
    expect(MODELO_NUBE).toBe("claude-opus-5-5");
    expect(MAX_TOKENS_NUBE).toBe(8192);
    expect(ESFUERZO_NUBE).toBe("low");
  });
});

describe("armarCuerpoNube · la forma exacta del cuerpo", () => {
  it("lleva solo el modelo, max_tokens, system, el mensaje, el pensamiento y output_config", () => {
    const { pedido } = pedidoFicticio();
    const { cuerpo, limiteMs } = armado(pedido);
    expect(cuerpo).toEqual({
      model: "claude-opus-5-5",
      max_tokens: 8192,
      system: PROMPT_FICTICIO.texto,
      messages: [{ role: "user", content: jsonCanonico(pedido.vista) }],
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA_ESTRICTO } },
      // Revisión de seguridad (M4): capacidad y velocidad estándar explícitas, al precio que modela el tope.
      service_tier: "standard_only",
      speed: "standard",
    });
    expect(Object.keys(cuerpo).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "service_tier", "speed", "system", "thinking"]);
    expect(limiteMs).toBe(LIMITE_FICTICIO_MS);
  });

  it("sin temperature, top_p, top_k, fallbacks, betas, stream, herramientas ni metadatos", () => {
    const { cuerpo } = armado(pedidoFicticio().pedido);
    for (const campo of ["temperature", "top_p", "top_k", "fallbacks", "betas", "stream", "tools", "tool_choice", "metadata", "stop_sequences", "inference_geo", "cache_control", "container"]) {
      expect(cuerpo).not.toHaveProperty(campo);
    }
    expect(JSON.stringify(cuerpo)).not.toMatch(/"disabled"|budget_tokens/);
  });

  it("el JSON que se mide es el mismo cuerpo, y el cuerpo está congelado", () => {
    const resultado = armado(pedidoFicticio().pedido);
    expect(resultado.json).toBe(JSON.stringify(resultado.cuerpo));
    expect(Object.isFrozen(resultado.cuerpo)).toBe(true);
    expect(Object.isFrozen(resultado.cuerpo.output_config)).toBe(true);
    expect(Object.isFrozen(resultado.cuerpo.messages)).toBe(true);
  });

  it("no muta el esquema del pedido", () => {
    const { pedido } = pedidoFicticio();
    armado(pedido);
    expect(pedido.esquemaSalida).toEqual(ESQUEMA_FICTICIO);
  });

  it.each(TIPOS_DIARIOS)("%s: el contenido es la vista ciega, sin dígitos fuera de los ids ni datos del paquete", (tipo) => {
    const { paquete, pedido } = pedidoFicticio(tipo);
    const { cuerpo } = armado(pedido);
    const contenido = (cuerpo.messages[0] as { readonly content: string }).content;
    expect(contenido).toBe(jsonCanonico(pedido.vista));
    expect(hayDigitosFueraDeIds(contenido)).toBe(false);
    expect(fugasEn(contenido, paquete)).toEqual([]);
    expect(camposDeMas(JSON.parse(contenido))).toEqual([]);
    expect(cuerpo.system).toBe(PROMPT_FICTICIO.texto);
  });
});

describe("armarCuerpoNube · cierra en fallo sin lanzar", () => {
  const base = (): PedidoGeneracion => pedidoFicticio().pedido;

  it.each([
    ["el hash del prompt no cuadra", (p: PedidoGeneracion) => ({ ...p, prompt: { ...p.prompt, hash: "0".repeat(64) } })],
    ["un campo de más en el pedido", (p: PedidoGeneracion) => ({ ...p, paquete: pedidoFicticio().paquete })],
    ["un límite cero", (p: PedidoGeneracion) => ({ ...p, limiteMs: 0 })],
    ["un pedido nulo", () => null],
  ])("PEDIDO_INVALIDO: %s", (_caso, mutar) => {
    expect(armarCuerpoNube(mutar(base()) as unknown as PedidoGeneracion)).toEqual({ ok: false, detalle: "PEDIDO_INVALIDO" });
  });

  const conHecho = (p: PedidoGeneracion, cambio: (hecho: Record<string, unknown>) => unknown): PedidoGeneracion => {
    const [primero, ...resto] = p.vista.hechos as readonly Record<string, unknown>[];
    return { ...p, vista: { ...p.vista, hechos: [cambio(primero as Record<string, unknown>), ...resto] } } as unknown as PedidoGeneracion;
  };

  it.each([
    ["un campo de más en la vista", (p: PedidoGeneracion) => ({ ...p, vista: { ...p.vista, fuente: "fuente-ficticia" } })],
    ["un campo de más en un hecho", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, valor: "FICTICIA-ALFA" }))],
    ["una etiqueta con un dígito", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, etiqueta: "Valor de la especie 7" }))],
    ["una etiqueta con un dígito de ancho completo", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, etiqueta: "Valor ７" }))],
    ["un objeto anidado con una clave prohibida", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, etiqueta: { correo: "a" } }))],
    ["un número en lugar de texto", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, obligatorio: 1 }))],
    ["un número con decimales (sin forma canónica)", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, obligatorio: 4.613 }))],
    ["un hecho que no es objeto", (p: PedidoGeneracion) => conHecho(p, () => "H01")],
    ["un hecho sin un campo exigido", (p: PedidoGeneracion) => conHecho(p, ({ clave: _clave, ...resto }) => resto)],
    // Revisión de seguridad (MEDIO M1): textos sin dígitos pero fuera de las listas cerradas del contrato y del catálogo.
    ["una etiqueta que no es la del catálogo (un nombre)", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, etiqueta: "FICTICIA-ALFA" }))],
    ["un sujeto que no es un id", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, sujeto: "FICTICIA-ALFA" }))],
    ["un id que no es un id", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, id: "FICTICIA-ALFA" }))],
    ["una clave que no es del catálogo del tipo", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, clave: "CLAVE_FICTICIA" }))],
    ["una clave de otro tipo de resumen", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, clave: "REGLA_NIVEL" }))],
    ["una dirección fuera de la lista", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, direccion: "FICTICIA-ALFA" }))],
    ["una cercanía fuera de la lista", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, cercania: "ALGO" }))],
    ["una frescura fuera de la lista", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, frescura: "ALGO" }))],
    ["una calidad fuera de la lista", (p: PedidoGeneracion) => conHecho(p, (h) => ({ ...h, calidad: "ALGO" }))],
    ["hechos que no es arreglo", (p: PedidoGeneracion) => ({ ...p, vista: { ...p.vista, hechos: { H01: "x" } } })],
    ["una vista sin tipo", (p: PedidoGeneracion) => ({ ...p, vista: { hechos: p.vista.hechos } })],
    ["una vista nula", (p: PedidoGeneracion) => ({ ...p, vista: null })],
    ["una vista Proxy", (p: PedidoGeneracion) => ({ ...p, vista: new Proxy({ ...p.vista }, {}) })],
    ["un hecho con un getter", (p: PedidoGeneracion) => conHecho(p, (h) => Object.defineProperty({ ...h }, "etiqueta", { get: () => "x", enumerable: true }))],
  ])("VISTA_NO_CIEGA: %s", (_caso, mutar) => {
    expect(armarCuerpoNube(mutar(base()) as unknown as PedidoGeneracion)).toEqual({ ok: false, detalle: "VISTA_NO_CIEGA" });
  });

  it("ESQUEMA_NO_ADMITIDO: un subesquema sin tipo (el SDK no lo sabe pasar a la forma estricta)", () => {
    const pedido = { ...base(), esquemaSalida: { type: "object", properties: { frases: { items: { type: "string" } } } } } as PedidoGeneracion;
    expect(armarCuerpoNube(pedido)).toEqual({ ok: false, detalle: "ESQUEMA_NO_ADMITIDO" });
  });
});

describe("vistaParaNube", () => {
  it("devuelve el JSON canónico de una vista ciega, y null si no lo es", () => {
    const { pedido } = pedidoFicticio("REGLAS");
    expect(vistaParaNube(pedido.vista)).toBe(jsonCanonico(pedido.vista));
    expect(vistaParaNube({ ...pedido.vista, hoy: "x" })).toBeNull();
    expect(vistaParaNube(undefined)).toBeNull();
  });
});
