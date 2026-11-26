/**
 * `presentar(valor, unidad)`: la cadena es-CO de cada unidad, con los formatos de la pantalla (src/app/tablero/formato.ts).
 * Es la única fuente de la presentación de un hecho: `construirPaquete` exige `presentacion === presentar(valor, unidad)`
 * (condición 2 de PI desde el origen). Valores inventados, no redondos, y fechas de 2027.
 */
import { describe, expect, it } from "vitest";
import { entradaDeCatalogo } from "@/ia/catalogo";
import { UNIDADES, type TipoDiario, type Unidad } from "@/ia/contrato";
import { presentar } from "@/ia/presentar";
import { hhiEs, porcentajeEs } from "@/operar/analisis/texto";
import { crearPrng } from "@/proyecciones/prng";
import { paqueteAlAzar } from "../apoyo/aleatorio.ficticio";
import { ENTRADAS_FICTICIAS, entradaReglasConAnclas } from "../apoyo/hechos.ficticio";

const MENOS = "−";

describe("presentar · una cadena por unidad", () => {
  it.each<readonly [Unidad, string, string]>([
    ["PESOS", "37911.47", "$ 37.911"],
    ["PESOS", "-1237.53", `${MENOS}$ 1.238`],
    ["PESOS", "-0.41", "$ 0"],
    ["PESOS", "4613", "$ 4.613"],
    ["PESOS", "2713.9", "$ 2.714"],
    ["PESOS_POR_DOLAR", "4613.27", "$ 4.613,27"],
    ["PESOS_POR_DOLAR", "4613.276", "$ 4.613,28"],
    ["PESOS_POR_DOLAR", "-37.19", `${MENOS}$ 37,19`],
    ["PORCENTAJE", "12.37", "12,4 %"],
    ["PORCENTAJE", "-2.47", `${MENOS}2,5 %`],
    ["PORCENTAJE", "-0.04", "0,0 %"],
    ["PORCENTAJE", "1237.53", "1.237,5 %"],
    ["DIAS", "190", "190 días"],
    ["DIAS", "1", "1 día"],
    ["DIAS", "-1", `${MENOS}1 día`],
    ["DIAS", "4613", "4.613 días"],
    ["DIAS", "0", "0 días"],
    ["MESES", "3", "3 meses"],
    ["MESES", "1", "1 mes"],
    ["MESES", "13", "13 meses"],
    ["ESPECIES", "7", "7"],
    ["ESPECIES", "1237", "1.237"],
    ["FECHA", "2027-03-16", "16-mar-2027"],
    ["FECHA", "2019-11-03", "3-nov-2019"],
    ["NOMBRE", "FICTICIA-ALFA", "FICTICIA-ALFA"],
  ])("%s · %s → «%s»", (unidad, valor, esperada) => {
    expect(presentar(valor, unidad)).toBe(esperada);
  });

  it("nunca pinta «+»: la dirección va aparte, en el hecho", () => {
    const positivos: readonly (readonly [Unidad, string])[] = [
      ["PESOS", "37.19"], ["PESOS_POR_DOLAR", "37.19"], ["PORCENTAJE", "37.19"], ["DIAS", "37"], ["MESES", "37"], ["ESPECIES", "37"],
    ];
    for (const [unidad, valor] of positivos) expect(presentar(valor, unidad), unidad).not.toContain("+");
  });

  it("lo que no se puede pintar sale «—», como en la pantalla", () => {
    expect(presentar("4613270000000000000000.19", "PESOS")).toBe("—");
    expect(presentar("4613270000000000000000.19", "PORCENTAJE")).toBe("—");
    expect(presentar("4613270000000000000000", "DIAS")).toBe("—");
    expect(presentar("4613270000000000000000.19", "PESOS_POR_DOLAR")).toBe("—");
  });

  it.each<readonly [Unidad, unknown]>([
    ["PESOS", "37.911,47"],
    ["PESOS", "37911.470"],
    ["PESOS", 37911.47],
    ["PORCENTAJE", "-0"],
    ["DIAS", "7.5"],
    ["MESES", "3.1"],
    ["ESPECIES", "7.1"],
    ["FECHA", "2027-02-30"],
    ["FECHA", "16-mar-2027"],
    ["NOMBRE", "FICTICIA  ALFA"],
    ["NOMBRE", ""],
    ["MESES", "-3"],
    ["ESPECIES", "-7"],
    ["OTRA" as Unidad, "7"],
  ])("rechaza con TypeError un valor sin la forma de la unidad (%s · %s), sin repetir el valor", (unidad, valor) => {
    expect(() => presentar(valor as string, unidad)).toThrow(TypeError);
    try {
      presentar(valor as string, unidad);
    } catch (e) {
      expect((e as Error).message).not.toMatch(/\p{N}/u);
      expect((e as Error).message.toLowerCase()).not.toContain("ficticia");
    }
  });

  it("cubre todas las unidades del contrato", () => {
    const muestras: Readonly<Record<Unidad, string>> = {
      PESOS: "1", PESOS_POR_DOLAR: "1", PORCENTAJE: "1", DIAS: "1", MESES: "1", ESPECIES: "1", FECHA: "2027-03-16", NOMBRE: "FICTICIA-ALFA", VECES: "1", PUNTOS: "1",
    };
    for (const unidad of UNIDADES) expect(presentar(muestras[unidad], unidad), unidad).toMatch(/\S/);
  });
});

/** La unidad que el catálogo del tipo da a la clave. */
const unidadDe = (tipo: TipoDiario, clave: string): Unidad => {
  const entrada = entradaDeCatalogo(tipo, clave);
  if (entrada === null) throw new Error(`clave fuera del catálogo: ${clave}`);
  return entrada.unidad;
};

describe("presentar · los apoyos de las pruebas salen de presentar", () => {
  it.each(Object.keys(ENTRADAS_FICTICIAS) as TipoDiario[])("cada hecho de la entrada ficticia %s trae presentar(valor, unidad)", (tipo) => {
    for (const h of ENTRADAS_FICTICIAS[tipo]().hechos) expect(h.presentacion, `${tipo} ${h.id}`).toBe(presentar(h.valor, unidadDe(tipo, h.clave)));
  });

  it("las cadenas que fijan las pruebas de la vista ciega y de la guarda no cambian", () => {
    const diario = ENTRADAS_FICTICIAS.DIARIO().hechos;
    expect(diario[2]?.presentacion).toBe("$ 37.911");
    expect(diario[6]?.presentacion).toBe("12,4 %");
    expect(diario[1]?.presentacion).toBe("$ 4.613");
  });

  it("la entrada de reglas con anclas también trae presentar(valor, unidad)", () => {
    for (const h of entradaReglasConAnclas().hechos) expect(h.presentacion, h.id).toBe(presentar(h.valor, unidadDe("REGLAS", h.clave)));
  });

  it("propiedad (semilla fija): en trescientos paquetes al azar, toda presentación es presentar(valor, unidad)", () => {
    const prng = crearPrng(37913);
    for (let i = 0; i < 300; i += 1) {
      const paquete = paqueteAlAzar(prng);
      for (const h of paquete.hechos) expect(h.presentacion).toBe(presentar(h.valor, h.unidad));
    }
  });
});

/**
 * VECES (razón, p. ej. la contribución al riesgo sobre el peso) y PUNTOS (el HHI): la presentación es IDÉNTICA a la del
 * análisis de /operar (`vecesEs` en revisar.ts y `hhiEs` en texto.ts), para que la pantalla y la IA no se contradigan.
 * `vecesEs` no se exporta: aquí se repite su fórmula exacta con `porcentajeEs`, que sí.
 */
const vecesComoRevisar = (x: number): string => `${porcentajeEs(x.toFixed(2))} veces`;

describe("presentar · VECES y PUNTOS (las del análisis de /operar)", () => {
  it.each<readonly [Unidad, string, string]>([
    ["VECES", "2.5", "2,50 veces"],
    ["VECES", "0", "0,00 veces"],
    ["VECES", "1", "1,00 veces"],
    ["VECES", "0.004", "0,00 veces"],
    ["VECES", "1234.567", "1.234,57 veces"],
    ["PUNTOS", "0.2113", "0,211"],
    ["PUNTOS", "0.2115", "0,212"],
    ["PUNTOS", "1.0005", "1,001"],
    ["PUNTOS", "0.1005", "0,101"],
    ["PUNTOS", "0.0004", "0,000"],
    ["PUNTOS", "0.9995", "1,000"],
    ["PUNTOS", "1", "1,000"],
    ["PUNTOS", "0", "0,000"],
    ["PUNTOS", "12345.6789", "12.345,679"],
  ])("%s · %s → «%s»", (unidad, valor, esperada) => {
    expect(presentar(valor, unidad)).toBe(esperada);
  });

  it("propiedad (semilla fija): en dos mil valores al azar, VECES y PUNTOS son idénticas a vecesEs y hhiEs", () => {
    const prng = crearPrng(41207);
    for (let i = 0; i < 2000; i += 1) {
      const x = Math.round(prng.uniforme() * (i % 4 === 0 ? 2_000_000 : 3) * 1e6) / 1e6;
      const valor = String(x);
      expect(presentar(valor, "VECES"), valor).toBe(vecesComoRevisar(x));
      expect(presentar(valor, "PUNTOS"), valor).toBe(hhiEs(x));
    }
  });

  it("el cero y los empates de redondeo también coinciden", () => {
    for (const valor of ["0", "0.005", "0.015", "0.025", "1.005", "2.675", "0.0005", "0.0015", "0.2225", "0.9995", "999.9995"]) {
      expect(presentar(valor, "VECES"), valor).toBe(vecesComoRevisar(Number(valor)));
      expect(presentar(valor, "PUNTOS"), valor).toBe(hhiEs(Number(valor)));
    }
  });

  it("nunca pinta «+» ni el signo menos: no admiten negativos (el análisis pinta mal un negativo)", () => {
    expect(presentar("2.5", "VECES")).not.toContain("+");
    expect(presentar("0.25", "PUNTOS")).not.toContain("+");
    for (const unidad of ["VECES", "PUNTOS"] as const) {
      expect(() => presentar("-0.25", unidad)).toThrow(TypeError);
      expect(() => presentar("-1", unidad)).toThrow(TypeError);
    }
  });

  it("lo que no se puede pintar sale «—», como en la pantalla", () => {
    expect(presentar("4613270000000000000000.19", "VECES")).toBe("—");
    expect(presentar("4613270000000000000000.19", "PUNTOS")).toBe("—");
  });

  it.each<readonly [Unidad, unknown]>([
    ["VECES", "2,5"],
    ["VECES", "2.50"],
    ["VECES", 2.5],
    ["VECES", ""],
    ["PUNTOS", "0.250"],
    ["PUNTOS", "1e-3"],
    ["PUNTOS", "FICTICIA-ALFA"],
    ["PUNTOS", undefined],
  ])("rechaza con TypeError un valor sin la forma de la unidad (%s · %s)", (unidad, valor) => {
    expect(() => presentar(valor as string, unidad)).toThrow(TypeError);
  });

  it("agregar unidades no cambia las presentaciones de las que ya había", () => {
    expect(presentar("37911.47", "PESOS")).toBe("$ 37.911");
    expect(presentar("12.37", "PORCENTAJE")).toBe("12,4 %");
    expect(presentar("190", "DIAS")).toBe("190 días");
  });
});
