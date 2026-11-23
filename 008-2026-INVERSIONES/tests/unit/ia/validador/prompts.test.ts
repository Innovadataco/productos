/**
 * Prompts versionados y esquema de salida (`src/ia/prompts/`). Los prompts son constantes: no llevan datos del paquete
 * (el cotejo de `armarPedido` es literal), ni dígitos fuera de la cita de ejemplo, ni trato de tú; dicen que no se
 * escriban cifras, que se cite `{Hnn}`, que no se recomiende y que no se prediga. El hash de cada versión queda fijo en
 * la tabla de abajo: cambiar el texto sin subir la versión pone esta prueba en rojo.
 */
import { describe, expect, it } from "vitest";
import { TIPOS_RESUMEN, type TipoResumen } from "@/ia/contrato";
import { armarPedido, PATRON_VERSION_PROMPT } from "@/ia/generador";
import { jsonCanonico, sha256Hex } from "@/ia/hash";
import { construirPaquete } from "@/ia/paquete";
import { ESQUEMA_SALIDA, HASH_ESQUEMA_SALIDA } from "@/ia/prompts/esquema";
import { PROMPTS, VERSIONES_PROMPT, promptDe } from "@/ia/prompts/prompts";
import { LIMITES_SALIDA } from "@/ia/validador/codigos";
import { coincidencias } from "@/ia/validador/patron";
import { PATRONES_TRATO } from "@/ia/validador/patrones-redaccion";
import { crearPrng } from "@/proyecciones/prng";
import { paqueteAlAzar } from "../apoyo/aleatorio.ficticio";
import { ENTRADAS_FICTICIAS } from "../apoyo/hechos.ficticio";

/** Historia de los prompts: cada versión, con el sha256 de su texto. Una versión nueva se agrega; nunca se edita una. */
const HISTORIAL: Readonly<Record<string, string>> = {
  "resumen-diario-v1": "18702a8e5a0b91fdd9c37526b82d7f0946b02baa6365a91a4ef68c5340892f85",
  "resumen-reglas-v1": "3d0af5e9baebaaa6d9e6b52add4aed18ad1dc316fcd2a256fe584fe0fc7f3ccb",
  "resumen-escenarios-v1": "2976993042570520f0ef548e52497191e1479ee948c1d5af293294c56336c391",
  "resumen-diario-v2": "f30294e2a06dbdf47f63abe3348003a9e8fb0d362ffcf271de88857219605732",
  "resumen-reglas-v2": "d26e9308ba4006e3b8494d087770f8ceac0eaf40ae9367568bedf0794f3632b1",
  "resumen-escenarios-v2": "c1ba2a25244f0a612ed255c1f6506df4376ad8dad293a7ae06ed9c74e814698f",
  "resumen-diario-v3": "96cf1d259fbfd2270fd5611f61244020ccf8313f8696773876bdaeec77ae7e0f",
  "resumen-reglas-v3": "276f369f69801eaeecb61bb6d3262802190c56b2f642cfc6746389c2c836faa3",
  "resumen-escenarios-v3": "f3ea6626c67314fa2c9140f5033814b5dfcc171a83e9347121f8a64cda1cdd97",
};

/** Los límites del validador, como los dice el prompt (en palabras: el prompt no lleva dígitos). */
const LIMITES_EN_PALABRAS: Readonly<Record<number, string>> = { 1: "una", 6: "seis", 280: "doscientos ochenta", 1200: "mil doscientos" };
const LIMITE_MS = 4613;

describe("prompts versionados", () => {
  it.each(TIPOS_RESUMEN)("%s: versión válida, en la historia, con su hash sha256", (tipo) => {
    const prompt = PROMPTS[tipo];
    expect(prompt.version).toBe(VERSIONES_PROMPT[tipo]);
    expect(prompt.version).toMatch(PATRON_VERSION_PROMPT);
    expect(prompt.hash).toBe(sha256Hex(prompt.texto));
    expect(HISTORIAL[prompt.version]).toBe(prompt.hash);
    expect(promptDe(tipo)).toBe(prompt);
    expect(Object.isFrozen(prompt)).toBe(true);
  });

  it("las versiones y los textos son distintos por tipo; la tabla de versiones está congelada", () => {
    expect(new Set(TIPOS_RESUMEN.map((t) => PROMPTS[t].version)).size).toBe(TIPOS_RESUMEN.length);
    expect(new Set(TIPOS_RESUMEN.map((t) => PROMPTS[t].texto)).size).toBe(TIPOS_RESUMEN.length);
    expect(Object.isFrozen(PROMPTS)).toBe(true);
    expect(Object.isFrozen(VERSIONES_PROMPT)).toBe(true);
    expect(Object.keys(HISTORIAL)).toEqual(expect.arrayContaining(TIPOS_RESUMEN.map((t) => VERSIONES_PROMPT[t])));
  });

  it("promptDe con un tipo que no existe lanza (cierra en fallo)", () => {
    expect(() => promptDe("SEMANAL" as TipoResumen)).toThrow(RangeError);
    expect(() => promptDe("constructor" as TipoResumen)).toThrow(RangeError);
  });

  it.each(TIPOS_RESUMEN)("%s: sin dígitos fuera del id de ejemplo «H01»", (tipo) => {
    const texto = PROMPTS[tipo].texto;
    expect(texto).toContain('{"ref":"H01"}');
    expect(texto.replace(/H01/g, "")).not.toMatch(/\p{N}/u);
  });

  it.each(TIPOS_RESUMEN)("%s: de usted y sin trato de tú ni voseo", (tipo) => {
    const texto = PROMPTS[tipo].texto;
    expect(texto).toMatch(/de usted/);
    expect(coincidencias(texto, PATRONES_TRATO)).toEqual([]);
  });

  it.each(TIPOS_RESUMEN)("%s: dice que no escriba cifras, que cite, que no recomiende y que no prediga", (tipo) => {
    const texto = PROMPTS[tipo].texto.toLowerCase();
    for (const instruccion of ["no escriba cifras", "segmento de referencia", "nunca escriba el id ni llaves dentro de la prosa", "no recomiende", "no prediga", "cite todos los hechos obligatorios", "solo con un json"]) {
      expect(texto).toContain(instruccion);
    }
  });

  it.each(TIPOS_RESUMEN)("%s: dice los límites del validador, en palabras", (tipo) => {
    const texto = PROMPTS[tipo].texto;
    expect([LIMITES_SALIDA.minFrases, LIMITES_SALIDA.maxFrases, LIMITES_SALIDA.maxLargoFrase, LIMITES_SALIDA.maxLargoTotal]).toEqual([1, 6, 280, 1200]);
    for (const palabras of Object.values(LIMITES_EN_PALABRAS)) expect(texto).toContain(palabras);
  });
});

describe("esquema de salida", () => {
  const PROHIBIDAS = ["minLength", "maxLength", "minItems", "maxItems", "format", "minimum", "maximum", "multipleOf", "enum"];

  function recorrer(valor: unknown, visitar: (registro: Record<string, unknown>) => void): void {
    if (Array.isArray(valor)) valor.forEach((v) => recorrer(v, visitar));
    else if (typeof valor === "object" && valor !== null) {
      visitar(valor as Record<string, unknown>);
      Object.values(valor).forEach((v) => recorrer(v, visitar));
    }
  }

  it("está congelado a fondo (la forma exacta, en salida-v2.test.ts)", () => {
    recorrer(ESQUEMA_SALIDA, (r) => expect(Object.isFrozen(r)).toBe(true));
  });

  it("solo `ref` lleva `pattern` (el id); el resto de restricciones, ninguna", () => {
    const conPatron: Record<string, unknown>[] = [];
    recorrer(ESQUEMA_SALIDA, (r) => { if ("pattern" in r) conPatron.push(r); });
    expect(conPatron).toEqual([{ type: "string", pattern: "^H[0-9]{2}$" }]);
  });

  it("no usa restricciones que rompen la gramática de Ollama o que la salida estructurada de Claude no admite", () => {
    const halladas: string[] = [];
    recorrer(ESQUEMA_SALIDA, (r) => halladas.push(...Object.keys(r).filter((k) => PROHIBIDAS.includes(k))));
    expect(halladas).toEqual([]);
  });

  it("cada objeto cierra sus campos: additionalProperties false y todos requeridos", () => {
    recorrer(ESQUEMA_SALIDA, (r) => {
      if (r.type !== "object") return;
      expect(r.additionalProperties).toBe(false);
      expect([...(r.required as string[])].sort()).toEqual(Object.keys(r.properties as object).sort());
    });
  });

  it("va en forma canónica (el orden que llega al generador) y su hash es el de esa forma", () => {
    expect(JSON.stringify(ESQUEMA_SALIDA)).toBe(jsonCanonico(ESQUEMA_SALIDA));
    expect(HASH_ESQUEMA_SALIDA).toBe(sha256Hex(jsonCanonico(ESQUEMA_SALIDA)));
  });
});

describe("armarPedido acepta cada prompt con el esquema (sin datos del paquete en el pedido)", () => {
  it.each(TIPOS_RESUMEN)("%s: con la entrada ficticia", (tipo) => {
    const paquete = construirPaquete(ENTRADAS_FICTICIAS[tipo]());
    const pedido = armarPedido({ paquete, prompt: PROMPTS[tipo], esquemaSalida: ESQUEMA_SALIDA, limiteMs: LIMITE_MS });
    expect(pedido.prompt).toEqual({ texto: PROMPTS[tipo].texto, version: PROMPTS[tipo].version, hash: PROMPTS[tipo].hash });
    expect(JSON.stringify(pedido.esquemaSalida)).toBe(JSON.stringify(ESQUEMA_SALIDA));
  });

  it.each(TIPOS_RESUMEN)("%s: con paquetes al azar (semilla fija)", (tipo) => {
    const prng = crearPrng(37_911);
    for (let i = 0; i < 211; i += 1) {
      const paquete = paqueteAlAzar(prng, tipo);
      expect(() => armarPedido({ paquete, prompt: PROMPTS[tipo], esquemaSalida: ESQUEMA_SALIDA, limiteMs: LIMITE_MS })).not.toThrow();
    }
  });
});
