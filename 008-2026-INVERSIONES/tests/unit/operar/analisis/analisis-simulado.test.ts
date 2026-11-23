// El análisis del antes y el después de una operación simulada en /operar: el portafolio simulado (tablero e historia
// con la cantidad nueva), la comparación con el motor de src/analisis/ sin cambiar sus cálculos, los escenarios de
// src/proyecciones/ a 3, 6 y 12 meses y el texto armado por el código (plantilla determinista, sin IA), con el candado
// de lenguaje. Datos inventados (FICTICIA-*, fechas anteriores a 2022).
import { describe, expect, it } from "vitest";
import { analizar } from "@/analisis/analizar";
import type { Observacion } from "@/analisis/catalogo";
import { compararAnalisis, diferenciaPuntos, resumenEscenario } from "@/operar/analisis/comparar";
import { portafolioDespues } from "@/operar/analisis/despues";
import { frasesAnalisis, ROTULO_ANALISIS } from "@/operar/analisis/texto";
import type { ComparacionAnalisis } from "@/operar/analisis/tipos";
import type { ResultadoProyeccion } from "@/proyecciones/tipos";
import { diasHabiles, portafolio, retornosRepetidos, serieDeRetornos, type EspecieFicticia } from "../../analisis/fixtures/portafolio.ficticio";
import { prohibidasEn } from "../informe/lenguaje";

const DIAS = diasHabiles("2019-01-02", 300);
const especie = (id: string, cantidad: number, inicial: number, escala: number): EspecieFicticia => ({
  id, cantidad, cierres: serieDeRetornos(DIAS, inicial, retornosRepetidos(DIAS.length - 1, escala)),
});
const ENTRADAS = portafolio([especie("FICTICIA-A", 37, 1237.4, 1), especie("FICTICIA-B", 11, 4613.27, 2.3), especie("FICTICIA-C", 23, 905.61, 1.7)]);

describe("portafolioDespues", () => {
  it("cambia solo la cantidad de la especie operada en el tablero y en la historia, sin mutar la entrada", () => {
    const copia = JSON.stringify(ENTRADAS, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
    const d = portafolioDespues(ENTRADAS, "FICTICIA-B", 47n);
    const b = d.tablero.filas.find((f) => f.instrumentoId === "FICTICIA-B")!;
    expect(b.cantidad).toBe(47n);
    expect(b.valor?.toFixed()).toBe(b.cierre!.precio.mul(47).toFixed());
    expect(d.tablero.valorAcciones.toFixed()).toBe(d.tablero.filas.reduce((s, f) => s.add(f.valor ?? 0), ENTRADAS.tablero.valorAcciones.sub(ENTRADAS.tablero.valorAcciones)).toFixed());
    const enHistoria = d.historia.posiciones.find((p) => p.instrumentoId === "FICTICIA-B");
    expect(enHistoria?.tipo === "ACCION" && enHistoria.cantidad).toBe(47);
    expect(JSON.stringify(ENTRADAS, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v))).toBe(copia);
    expect(() => analizar({ ...ENTRADAS, ...d })).not.toThrow();
  });

  it("vender todo la pasa a las cerradas; comprar una cerrada la vuelve viva", () => {
    const sinB = portafolioDespues(ENTRADAS, "FICTICIA-B", 0n);
    expect(sinB.tablero.filas.map((f) => f.instrumentoId)).not.toContain("FICTICIA-B");
    expect(sinB.tablero.cerradas.map((f) => f.instrumentoId)).toContain("FICTICIA-B");
    const otraVez = portafolioDespues({ ...ENTRADAS, ...sinB }, "FICTICIA-B", 13n);
    expect(otraVez.tablero.filas.find((f) => f.instrumentoId === "FICTICIA-B")?.cantidad).toBe(13n);
  });
});

describe("compararAnalisis", () => {
  it("toma la concentración, la volatilidad y la contribución de la especie del motor, antes y después", () => {
    const antes = analizar(ENTRADAS);
    const despues = analizar({ ...ENTRADAS, ...portafolioDespues(ENTRADAS, "FICTICIA-B", 113n) });
    const c = compararAnalisis({ antes, despues, puntosAntes: [], puntosDespues: [], instrumentoId: "FICTICIA-B" });
    expect(c.concentracion.antes).toEqual({ primera: antes.concentracion!.primera, tresPrimeras: antes.concentracion!.tresPrimeras.peso, hhi: antes.concentracion!.hhi });
    expect(c.concentracion.despues?.primera.instrumentoId).toBe("FICTICIA-B");
    expect(c.volatilidad.antes).toBe(antes.riesgo.estado === "CALCULADO" ? antes.riesgo.volatilidadAnual : null);
    expect(c.volatilidad.despues).not.toBeNull();
    const bAntes = antes.especies.find((e) => e.instrumentoId === "FICTICIA-B")!;
    expect(c.pesoOperada.antes).toBe(bAntes.peso);
    expect(c.contribucionOperada.antes).toBe(bAntes.riesgo.estado === "CUBIERTA" ? bAntes.riesgo.contribucion?.contribucionPct : null);
    expect(c.contribucionOperada.despues!).toBeGreaterThan(c.contribucionOperada.antes!);
  });
});

const alta = (id: string, peso: number): Observacion => ({ clave: "CONCENTRACION_ALTA", umbral: 0.25, datos: { instrumentoId: id, peso } }) as Observacion;
const corr = (x: string, y: string): Observacion => ({ clave: "CORRELACION_ALTA", umbral: 0.8, datos: { instrumentoIds: [x, y], correlacion: 0.91 } }) as Observacion;

describe("diferenciaPuntos", () => {
  it("un punto es el mismo si tiene la misma clave y los mismos ids, aunque cambie la cifra", () => {
    const r = diferenciaPuntos([alta("FICTICIA-A", 0.31), corr("FICTICIA-A", "FICTICIA-C")], [alta("FICTICIA-A", 0.27), alta("FICTICIA-B", 0.41)]);
    expect(r.aparecen).toEqual([alta("FICTICIA-B", 0.41)]);
    expect(r.desaparecen).toEqual([corr("FICTICIA-A", "FICTICIA-C")]);
  });
});

const punto = (mes: number, base: number) => ({ mes, p5: base * 0.83, p25: base * 0.91, p50: base, p75: base * 1.07, p95: base * 1.19, aportado: 4613.27, dividendosP50: 0 });

describe("resumenEscenario", () => {
  it("toma p5, p50 y p95 a 3, 6 y 12 meses y la probabilidad de quedar por debajo de lo aportado", () => {
    const r = { puntos: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => punto(m, 4613.27 + m * 37.11)), probabilidadBajoAportado: 0.2371 } as unknown as ResultadoProyeccion;
    const e = resumenEscenario(r);
    expect(e.puntos.map((p) => p.mes)).toEqual([3, 6, 12]);
    expect(e.puntos[2]).toEqual({ mes: 12, p5: punto(12, 4613.27 + 12 * 37.11).p5, p50: 4613.27 + 12 * 37.11, p95: punto(12, 4613.27 + 12 * 37.11).p95 });
    expect(e.probabilidadBajoAportado).toBe(0.2371);
  });
});

const COMPARACION: ComparacionAnalisis = {
  concentracion: {
    antes: { primera: { instrumentoId: "FICTICIA-A", peso: 0.4613 }, tresPrimeras: 0.9137, hhi: 0.3719 },
    despues: { primera: { instrumentoId: "FICTICIA-B", peso: 0.5237 }, tresPrimeras: 0.9311, hhi: 0.4127 },
  },
  volatilidad: { antes: 0.1937, despues: 0.2411 },
  pesoOperada: { antes: 0.2113, despues: 0.5237 },
  contribucionOperada: { antes: 0.2719, despues: 0.6131 },
  puntos: { aparecen: [alta("FICTICIA-B", 0.5237)], desaparecen: [] },
};
const NOMBRES = new Map([["FICTICIA-A", "FICTA"], ["FICTICIA-B", "FICTB"]]);
const ESCENARIOS = {
  antes: { puntos: [{ mes: 3, p5: 41_371.3, p50: 46_131.7, p95: 51_237.9 }, { mes: 6, p5: 39_113.1, p50: 46_711.3, p95: 53_917.1 }, { mes: 12, p5: 37_911.47, p50: 47_113.9, p95: 57_311.3 }], probabilidadBajoAportado: 0.3137 },
  despues: { puntos: [{ mes: 3, p5: 40_137.3, p50: 46_173.1, p95: 52_371.9 }, { mes: 6, p5: 37_131.1, p50: 46_913.7, p95: 55_179.3 }, { mes: 12, p5: 35_717.3, p50: 47_391.1, p95: 59_137.7 }], probabilidadBajoAportado: 0.3371 },
};

describe("frasesAnalisis", () => {
  const frases = frasesAnalisis({ comparacion: COMPARACION, escenarios: ESCENARIOS, nombres: NOMBRES, operadaId: "FICTICIA-B", lado: "COMPRAR", plan: "Su regla de FICTB dice: vender 41 si el cierre queda por encima de $ 4.600,13." });

  it("arma de 3 a 5 frases con las cifras del antes y el después", () => {
    expect(frases.length).toBeGreaterThanOrEqual(3);
    expect(frases.length).toBeLessThanOrEqual(5);
    expect(frases[0]).toBe("Con esta compra, FICTB pasa de 21,13 % a 52,37 % del valor de las acciones; las tres primeras especies pasan de 91,37 % a 93,11 % y el HHI, de 0,372 a 0,413.");
    expect(frases[1]).toBe("La volatilidad anual del portafolio pasa de 19,37 % a 24,11 % y la contribución de FICTB al riesgo, de 27,19 % a 61,31 %.");
    expect(frases[2]).toBe("En el escenario central a 12 meses (mediana), el portafolio pasa de $ 47.114 a $ 47.391; la probabilidad de quedar por debajo de lo aportado, de 31,37 % a 33,71 %.");
    expect(frases[3]).toBe("Aparece 1 punto para revisar: concentración alta en FICTB.");
    expect(frases[4]).toBe("Su plan para esta especie: Su regla de FICTB dice: vender 41 si el cierre queda por encima de $ 4.600,13.");
  });

  it("sin escenarios ni historia, lo dice sin inventar cifras", () => {
    const sin = frasesAnalisis({
      comparacion: { ...COMPARACION, volatilidad: { antes: null, despues: null }, contribucionOperada: { antes: null, despues: null }, puntos: { aparecen: [], desaparecen: [] } },
      escenarios: null, nombres: NOMBRES, operadaId: "FICTICIA-B", lado: "VENDER", plan: null,
    });
    expect(sin[0]).toMatch(/^Con esta venta, FICTB pasa de/);
    expect(sin[1]).toBe("La volatilidad del portafolio no se calcula: falta historia de precios.");
    expect(sin[2]).toBe("Los escenarios no se calcularon en esta simulación.");
    expect(sin[3]).toBe("Los puntos para revisar no cambian.");
    expect(sin).toHaveLength(4);
  });

  it("candado de lenguaje: ni consejo ni «compre», «venda» u «oportunidad» (con control positivo)", () => {
    expect(prohibidasEn([...frases, ROTULO_ANALISIS].join(" "))).toEqual([]);
    expect(prohibidasEn("Compre FICTB: es una oportunidad.")).toEqual(["compre", "oportunidad"]);
    expect(ROTULO_ANALISIS).toBe("Análisis calculado por Inversiones · la IA lo redactará cuando el servicio de IA esté conectado");
  });
});
