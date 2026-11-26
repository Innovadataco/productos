/**
 * Una etiqueta afirmada sobre el hecho que no es (solo SIMULACION). Con solo palabras de etiqueta, «El peso de la especie…
 * queda en …, muy elevado, al nivel de la regla» afirmaba algo que ningún hecho respalda. Ahora la palabra distintiva de la
 * etiqueta de un punto (derivada del catálogo de SIMULACION, nunca a mano) solo vale junto a una cita del hecho que lleva esa
 * etiqueta; si no, ETIQUETA_NO_COINCIDE con el patrón ETIQUETA.SIN_HECHO. También: el nombre de la especie citado dos veces en
 * una frase se rechaza (FORMATO.NOMBRE_REPETIDO). DIARIO, REGLAS y ESCENARIOS no cambian.
 */
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/ia/catalogo";
import { TIPOS_DIARIOS } from "@/ia/contrato";
import { construirPaquete } from "@/ia/paquete";
import { segmentosDe } from "@/ia/validador/segmentos";
import { PALABRAS_DE_ETIQUETA } from "@/ia/validador/etiquetas-simulacion";
import { validarSalida } from "@/ia/validador/validar";
import { ENTRADAS_FICTICIAS, entradaSimulacion } from "../apoyo/hechos.ficticio";
import { frase } from "../validador/apoyo/salidas.ficticio";

const paquete = construirPaquete(entradaSimulacion());
const N = "{ESPECIE_NOMBRE}";
const PESO = `El peso de la especie ${N} queda en {PESO_ESPECIE}, muy elevado.`;
const RESTO = [
  `La contribución de la especie ${N} al riesgo queda en {PUNTO_CONTRIBUCION_RIESGO}, mucho mayor que su peso.`,
  `La cercanía al nivel de la regla de la especie ${N} queda en {PUNTO_NIVEL_REGLA}, muy cerca de su nivel.`,
  "La concentración del portafolio queda en {PUNTO_CONCENTRACION}, elevada.",
];
const salida = (primera: string, resto: readonly string[] = RESTO): string =>
  JSON.stringify({ frases: [primera, ...resto].map((p) => ({ segmentos: segmentosDe(frase(paquete, p).texto) })), revisar: [] });
const resultado = (primera: string, resto?: readonly string[]) => validarSalida(salida(primera, resto), paquete);
const hallazgos = (primera: string): readonly string[] => {
  const r = resultado(primera);
  return r.ok ? [] : r.hallazgos.map((h) => h.patron);
};
const motivos = (primera: string): readonly string[] => {
  const r = resultado(primera);
  return r.ok ? [] : r.motivos;
};

describe("las palabras distintivas de cada etiqueta salen del catálogo de SIMULACION", () => {
  it("cada palabra pertenece a UNA sola clave, tiene más de tres letras y sale de su etiqueta", () => {
    for (const [palabra, clave] of PALABRAS_DE_ETIQUETA) {
      const etiqueta = (CATALOGO.SIMULACION as Record<string, { etiqueta: string }>)[clave]?.etiqueta ?? "";
      expect(palabra.length, palabra).toBeGreaterThan(3);
      expect(etiqueta.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase(), palabra).toContain(palabra);
      const dueñas = Object.entries(CATALOGO.SIMULACION).filter(([, e]) => e.etiqueta.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/\p{L}+/gu)?.includes(palabra));
      expect(dueñas.map(([c]) => c), palabra).toEqual([clave]);
    }
  });

  it("incluye los núcleos de las etiquetas: nivel, cercania, concentracion, efecto, caida, contribucion, riesgo, peso, probabilidad, debajo, aportado", () => {
    const claves = new Map(PALABRAS_DE_ETIQUETA);
    expect(claves.get("nivel")).toBe("PUNTO_NIVEL_REGLA");
    expect(claves.get("cercania")).toBe("PUNTO_NIVEL_REGLA");
    expect(claves.get("concentracion")).toBe("PUNTO_CONCENTRACION");
    expect(claves.get("efecto")).toBe("PUNTO_EFECTO_CAIDA");
    expect(claves.get("caida")).toBe("PUNTO_EFECTO_CAIDA");
    expect(claves.get("contribucion")).toBe("PUNTO_CONTRIBUCION_RIESGO");
    expect(claves.get("riesgo")).toBe("PUNTO_CONTRIBUCION_RIESGO");
    expect(claves.get("peso")).toBe("PESO_ESPECIE");
    expect(claves.get("probabilidad")).toBe("PROBABILIDAD_BAJO_APORTADO");
    expect(claves.get("debajo")).toBe("PROBABILIDAD_BAJO_APORTADO");
    expect(claves.get("aportado")).toBe("PROBABILIDAD_BAJO_APORTADO");
    expect(claves.has("especie")).toBe(false);
    expect(claves.has("portafolio")).toBe(false);
  });
});

describe("control positivo: las frases correctas siguen publicando", () => {
  it("el corpus bueno (las cuatro frases) publica", () => {
    const r = resultado(PESO);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it("con la probabilidad y su etiqueta exacta «por debajo de lo aportado» junto a su hecho también", () => {
    const r = resultado(PESO, [RESTO[0] as string, RESTO[1] as string, "La probabilidad de quedar por debajo de lo aportado queda en {PROBABILIDAD_BAJO_APORTADO}, elevada."]);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it("un ítem con su etiqueta y su hecho publica", () => {
    const conItem = JSON.stringify({
      frases: [PESO, ...RESTO].map((p) => ({ segmentos: segmentosDe(frase(paquete, p).texto) })),
      revisar: [{ segmentos: segmentosDe(frase(paquete, `Peso de la especie ${N}, {PESO_ESPECIE}`).texto) }],
    });
    expect(validarSalida(conItem, paquete).ok).toBe(true);
  });
});

describe("una etiqueta sin el hecho que la lleva da ETIQUETA_NO_COINCIDE (ETIQUETA.SIN_HECHO)", () => {
  it.each([
    ["el nivel de la regla afirmado sobre el peso (frase del revisor 1)", `El peso de la especie ${N} queda en {PESO_ESPECIE}, muy elevado, al nivel de la regla.`],
    ["«es el nivel de la regla en …» sobre el peso (frase del revisor 2)", `El peso de la especie ${N} es el nivel de la regla en {PESO_ESPECIE}, muy elevado.`],
    ["«por debajo de lo aportado» sobre el peso", `El peso de la especie ${N} queda en {PESO_ESPECIE}, muy elevado, por debajo de lo aportado.`],
    ["el efecto de la caída sobre el peso", `El peso de la especie ${N} queda en {PESO_ESPECIE}, muy elevado, con el efecto de la caída.`],
    ["la contribución al riesgo sobre el peso", `El peso de la especie ${N} queda en {PESO_ESPECIE}, muy elevado, y la contribución al riesgo.`],
    ["la concentración sobre el peso", `La concentración de la especie ${N} queda en {PESO_ESPECIE}, muy elevado.`],
    ["la etiqueta del peso sobre la concentración", "El peso del portafolio queda en {PUNTO_CONCENTRACION}, elevada."],
  ])("%s", (_caso, plantilla) => {
    expect(hallazgos(plantilla), plantilla).toContain("ETIQUETA.SIN_HECHO");
    expect(motivos(plantilla), plantilla).toContain("ETIQUETA_NO_COINCIDE");
  });

  it("la etiqueta sin ninguna cita cerca también se rechaza", () => {
    expect(motivos("El nivel de la regla queda muy elevado.")).toContain("ETIQUETA_NO_COINCIDE");
  });

  it("las palabras de un rango («mayor que su peso», «cerca de su nivel») no cuentan como la etiqueta del peso o del nivel", () => {
    expect(hallazgos(RESTO[0] as string)).not.toContain("ETIQUETA.SIN_HECHO");
    expect(hallazgos(RESTO[1] as string)).not.toContain("ETIQUETA.SIN_HECHO");
  });
});

describe("el nombre de la especie dos veces en una frase", () => {
  it("se rechaza (FORMATO.NOMBRE_REPETIDO)", () => {
    const doble = `El peso de la especie ${N} queda en {PESO_ESPECIE}, muy elevado, de la especie ${N}.`;
    expect(hallazgos(doble)).toContain("FORMATO.NOMBRE_REPETIDO");
    expect(motivos(doble)).toContain("FORMATO");
  });

  it("control positivo: una sola vez (en cada frase) publica", () => {
    expect(resultado(PESO).ok).toBe(true);
  });
});

describe("DIARIO, REGLAS y ESCENARIOS no cambian", () => {
  it.each(TIPOS_DIARIOS)("%s: la plantilla sigue publicando", async (tipo) => {
    const { resumenSinIa } = await import("@/ia/validador/plantilla");
    expect(resumenSinIa(construirPaquete(ENTRADAS_FICTICIAS[tipo]())).ok).toBe(true);
  });
});
