/**
 * Lectura de la salida `salida-v3` (solo SIMULACION): la forma exacta `{frases:[{segmentos}], revisar:[{segmentos}]}`.
 * Un campo de más, un `__proto__` o la falta de `revisar` la rechazan; se respeta el tope MAX_SALIDA_CRUDA; es total
 * (nunca lanza ni toca un Proxy). La forma v2 (sin `revisar`) no es v3 y la v3 no es v2: cada lector lee la suya.
 */
import { describe, expect, it } from "vitest";
import { MAX_SALIDA_CRUDA } from "@/ia/generador";
import { leerSalida } from "@/ia/validador/leer";
import { leerSalidaV3 } from "@/ia/validador/leer-v3";

const segmentos = [{ texto: "Texto ficticio " }, { ref: "H01" }, { texto: "." }];
const valida = JSON.stringify({ frases: [{ segmentos }], revisar: [{ segmentos: [{ texto: "Punto ficticio " }, { ref: "H02" }] }] });

describe("leerSalidaV3", () => {
  it("lee la forma exacta y devuelve una copia congelada con las frases y los ítems de revisar", () => {
    const leida = leerSalidaV3(valida);
    expect(leida).toEqual({
      frases: [{ texto: "Texto ficticio {H01}.", hechos: ["H01"] }],
      revisar: [{ texto: "Punto ficticio {H02}", hechos: ["H02"] }],
    });
    expect(Object.isFrozen(leida)).toBe(true);
    expect(Object.isFrozen(leida?.frases)).toBe(true);
    expect(Object.isFrozen(leida?.revisar)).toBe(true);
    expect(Object.isFrozen(leida?.revisar[0])).toBe(true);
    expect(Object.isFrozen(leida?.revisar[0]?.hechos)).toBe(true);
  });

  it("admite espacios alrededor y listas vacías (la cantidad la juzga otro control)", () => {
    expect(leerSalidaV3(`  ${valida}\n`)).not.toBeNull();
    expect(leerSalidaV3('{"frases":[],"revisar":[]}')).toEqual({ frases: [], revisar: [] });
    expect(leerSalidaV3(JSON.stringify({ revisar: [], frases: [] }))).toEqual({ frases: [], revisar: [] });
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["un número", 4613],
    ["un objeto", { frases: [], revisar: [] }],
    ["un Proxy", new Proxy({}, { get: () => { throw new Error("trampa"); }, getPrototypeOf: () => { throw new Error("trampa"); } })],
  ])("no es texto: %s", (_caso, cruda) => {
    expect(leerSalidaV3(cruda)).toBeNull();
  });

  it.each([
    ["JSON inválido", '{"frases":[],"revisar":'],
    ["vacío", ""],
    ["con BOM", `﻿${valida}`],
    ["con cerco de markdown", `\`\`\`json\n${valida}\n\`\`\``],
    ["un arreglo", "[]"],
    ["sin revisar (la forma v2)", '{"frases":[]}'],
    ["sin frases", '{"revisar":[]}'],
    ["vacío de campos", "{}"],
    ["revisar no es arreglo", '{"frases":[],"revisar":{}}'],
    ["revisar es texto", '{"frases":[],"revisar":"x"}'],
    ["frases no es arreglo", '{"frases":{},"revisar":[]}'],
    ["campo de más en la raíz", '{"frases":[],"revisar":[],"nota":"x"}'],
    ["__proto__ en la raíz", '{"frases":[],"revisar":[],"__proto__":{"x":1}}'],
    ["__proto__ en lugar de un campo", '{"frases":[],"__proto__":[]}'],
    ["ítem que no es objeto", '{"frases":[],"revisar":["texto"]}'],
    ["ítem nulo", '{"frases":[],"revisar":[null]}'],
    ["ítem arreglo", '{"frases":[],"revisar":[[]]}'],
    ["ítem sin segmentos", '{"frases":[],"revisar":[{}]}'],
    ["ítem con campo de más", '{"frases":[],"revisar":[{"segmentos":[],"nivel":"ALTA"}]}'],
    ["ítem con __proto__", '{"frases":[],"revisar":[{"segmentos":[],"__proto__":{"x":1}}]}'],
    ["segmentos del ítem no es arreglo", '{"frases":[],"revisar":[{"segmentos":"x"}]}'],
    ["segmento del ítem con campo de más", '{"frases":[],"revisar":[{"segmentos":[{"texto":"a","ref":"H01"}]}]}'],
    ["segmento del ítem con llaves en el texto", '{"frases":[],"revisar":[{"segmentos":[{"texto":"punto {H01}"}]}]}'],
    ["ref del ítem fuera del patrón", '{"frases":[],"revisar":[{"segmentos":[{"ref":"H1"}]}]}'],
    ["ref del ítem que no es texto", '{"frases":[],"revisar":[{"segmentos":[{"ref":1}]}]}'],
    ["frase con campo de más", '{"frases":[{"segmentos":[],"x":1}],"revisar":[]}'],
    ["frase con ref inválida", '{"frases":[{"segmentos":[{"ref":"H100"}]}],"revisar":[]}'],
  ])("lo rechaza: %s", (_caso, cruda) => {
    expect(leerSalidaV3(cruda)).toBeNull();
  });

  it("respeta el tope: un texto de MAX_SALIDA_CRUDA caracteres se lee y uno más largo se rechaza", () => {
    const armar = (relleno: number): string => JSON.stringify({ frases: [], revisar: [{ segmentos: [{ texto: "a".repeat(relleno) }] }] });
    const base = armar(0).length;
    const justo = armar(MAX_SALIDA_CRUDA - base);
    expect(justo.length).toBe(MAX_SALIDA_CRUDA);
    expect(leerSalidaV3(justo)).not.toBeNull();
    expect(leerSalidaV3(armar(MAX_SALIDA_CRUDA - base + 1))).toBeNull();
  });

  it("un JSON muy anidado se rechaza sin lanzar", () => {
    expect(leerSalidaV3(`${"[".repeat(5000)}${"]".repeat(5000)}`)).toBeNull();
  });

  it("el __proto__ del JSON no contamina el prototipo", () => {
    leerSalidaV3('{"frases":[],"revisar":[],"__proto__":{"polluted":true}}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("v2 y v3 no se confunden: el lector de v2 rechaza la v3 y el de v3 rechaza la v2", () => {
    expect(leerSalida(valida)).toBeNull();
    expect(leerSalidaV3(JSON.stringify({ frases: [{ segmentos }] }))).toBeNull();
    expect(leerSalida(JSON.stringify({ frases: [{ segmentos }] }))).not.toBeNull();
  });

  it("la frase y el ítem se arman igual: los segmentos unidos por el código, con las refs sin repetir", () => {
    const leida = leerSalidaV3(JSON.stringify({ frases: [{ segmentos: [{ ref: "H01" }, { texto: " y " }, { ref: "H01" }] }], revisar: [{ segmentos: [{ texto: "Puntos " }, { ref: "H03" }, { texto: ", " }, { ref: "H04" }] }] }));
    expect(leida?.frases[0]).toEqual({ texto: "{H01} y {H01}", hechos: ["H01"] });
    expect(leida?.revisar[0]).toEqual({ texto: "Puntos {H03}, {H04}", hechos: ["H03", "H04"] });
  });
});
