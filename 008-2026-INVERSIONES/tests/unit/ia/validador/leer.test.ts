/**
 * Lectura de la salida cruda (SALIDA_INVALIDA): solo un texto JSON de hasta MAX_SALIDA_CRUDA con la forma exacta
 * `{frases:[{segmentos:[{texto}|{ref}]}]}` (salida-v2; el detalle de los segmentos, en salida-v2.test.ts), sin campos de más (ni `__proto__`). Total: nunca lanza ni toca un Proxy.
 */
import { describe, expect, it } from "vitest";
import { MAX_SALIDA_CRUDA } from "@/ia/generador";
import { leerSalida } from "@/ia/validador/leer";

const valida = JSON.stringify({ frases: [{ segmentos: [{ texto: "Texto ficticio " }, { ref: "H01" }, { texto: "." }] }] });

describe("leerSalida", () => {
  it("lee la forma exacta y devuelve una copia congelada", () => {
    const leida = leerSalida(valida);
    expect(leida).toEqual({ frases: [{ texto: "Texto ficticio {H01}.", hechos: ["H01"] }] });
    expect(Object.isFrozen(leida?.frases[0]?.hechos)).toBe(true);
    expect(Object.isFrozen(leida)).toBe(true);
    expect(Object.isFrozen(leida?.frases)).toBe(true);
    expect(Object.isFrozen(leida?.frases[0])).toBe(true);
    expect(Object.isFrozen(leida?.frases[0]?.hechos)).toBe(true);
  });

  it("admite espacios alrededor del JSON y una lista de frases vacía (la longitud la juzga otro control)", () => {
    expect(leerSalida(`  ${valida}\n`)).not.toBeNull();
    expect(leerSalida('{"frases":[]}')).toEqual({ frases: [] });
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["un número", 4613],
    ["un objeto", { frases: [] }],
    ["un Proxy", new Proxy({}, { get: () => { throw new Error("trampa"); }, getPrototypeOf: () => { throw new Error("trampa"); } })],
  ])("no es texto: %s", (_caso, cruda) => {
    expect(leerSalida(cruda)).toBeNull();
  });

  it.each([
    ["JSON inválido", '{"frases":'],
    ["vacío", ""],
    ["con BOM", `\uFEFF${valida}`],
    ["con cerco de markdown", `\`\`\`json\n${valida}\n\`\`\``],
    ["un arreglo", "[]"],
    ["un texto JSON", '"frases"'],
    ["sin frases", "{}"],
    ["frases no es arreglo", '{"frases":{}}'],
    ["campo de más en la raíz", '{"frases":[],"nota":"x"}'],
    ["__proto__ en la raíz", '{"frases":[],"__proto__":{"x":1}}'],
    ["frase que no es objeto", '{"frases":["texto"]}'],
    ["frase nula", '{"frases":[null]}'],
    ["frase arreglo", '{"frases":[[]]}'],
    ["sin segmentos", '{"frases":[{}]}'],
    ["la forma vieja", '{"frases":[{"hechos":["H01"],"texto":"x {H01}."}]}'],
    ["segmentos no es arreglo", '{"frases":[{"segmentos":"H01"}]}'],
    ["un segmento con texto que no es texto", '{"frases":[{"segmentos":[{"texto":7}]}]}'],
    ["campo de más en la frase", '{"frases":[{"segmentos":[],"tono":"y"}]}'],
    ["__proto__ en la frase", '{"frases":[{"segmentos":[],"__proto__":{}}]}'],
  ])("rechaza: %s", (_caso, cruda) => {
    expect(leerSalida(cruda)).toBeNull();
  });

  it("rechaza la salida de más de MAX_SALIDA_CRUDA caracteres sin leerla; la del tope justo se lee", () => {
    const prefijo = '{"frases":[{"segmentos":[{"texto":"';
    const sufijo = '"}]}]}';
    const justa = `${prefijo}${"a".repeat(MAX_SALIDA_CRUDA - prefijo.length - sufijo.length)}${sufijo}`;
    expect(justa.length).toBe(MAX_SALIDA_CRUDA);
    expect(leerSalida(justa)).not.toBeNull();
    expect(leerSalida(`${justa} `)).toBeNull();
  });

  it("un JSON anidado sin fondo no lanza", () => {
    expect(leerSalida(`${"[".repeat(197_311)}${"]".repeat(197_311)}`.slice(0, MAX_SALIDA_CRUDA))).toBeNull();
  });
});
