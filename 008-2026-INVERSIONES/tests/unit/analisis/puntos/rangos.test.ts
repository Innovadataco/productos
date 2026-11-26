import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRIBUCION_MINIMA, FACTOR_CONTRIBUCION_DESPROPORCIONADA, UMBRAL_PESO_PRIMERA, UMBRAL_REGLA_CERCANA_PCT } from "@/analisis/catalogo";
import { CLAVES_PUNTO, TRAMOS, VERSION_PUNTOS, importanciaDe, rangoDe } from "@/analisis/puntos/rangos";
import { prohibidasEn } from "../../operar/informe/lenguaje";

const rango = (c: Parameters<typeof rangoDe>[0], x: number) => rangoDe(c, x)?.rango ?? null;

describe("rangos de los puntos", () => {
  it("la versión es puntos-v1", () => expect(VERSION_PUNTOS).toBe("puntos-v1"));

  it("peso de la especie: bordes exactos", () => {
    expect(rango("PESO_ESPECIE", 0.25)).toBeNull();
    expect(rango("PESO_ESPECIE", 0.2501)).toBe("ELEVADO");
    expect(rango("PESO_ESPECIE", 0.4)).toBe("ELEVADO");
    expect(rango("PESO_ESPECIE", 0.4001)).toBe("MUY_ELEVADO");
  });
  it("HHI: bordes exactos", () => {
    expect(rango("PUNTO_CONCENTRACION", 0.1499)).toBeNull();
    expect(rango("PUNTO_CONCENTRACION", 0.15)).toBe("MODERADA");
    expect(rango("PUNTO_CONCENTRACION", 0.25)).toBe("MODERADA");
    expect(rango("PUNTO_CONCENTRACION", 0.2501)).toBe("ELEVADA");
  });
  it("contribución al riesgo en veces: bordes exactos", () => {
    expect(rango("PUNTO_CONTRIBUCION_RIESGO", 1.4999)).toBeNull();
    expect(rango("PUNTO_CONTRIBUCION_RIESGO", 1.5)).toBe("DESPROPORCIONADA");
    expect(rango("PUNTO_CONTRIBUCION_RIESGO", 2.4999)).toBe("DESPROPORCIONADA");
    expect(rango("PUNTO_CONTRIBUCION_RIESGO", 2.5)).toBe("MUY_DESPROPORCIONADA");
  });
  it("efecto de una caída y probabilidad: bordes exactos", () => {
    expect(rango("PUNTO_EFECTO_CAIDA", 0.0499)).toBeNull();
    expect(rango("PUNTO_EFECTO_CAIDA", 0.05)).toBe("MEDIANO");
    expect(rango("PUNTO_EFECTO_CAIDA", 0.1)).toBe("GRANDE");
    expect(rango("PROBABILIDAD_BAJO_APORTADO", 0.0999)).toBeNull();
    expect(rango("PROBABILIDAD_BAJO_APORTADO", 0.1)).toBe("INTERMEDIA");
    expect(rango("PROBABILIDAD_BAJO_APORTADO", 0.25)).toBe("ELEVADA");
  });
  it("distancia a la regla (por ciento): bordes exactos", () => {
    expect(rango("REGLA_DISTANCIA", 0.9999)).toBe("MUY_CERCA");
    expect(rango("REGLA_DISTANCIA", 1)).toBe("CERCA");
    expect(rango("REGLA_DISTANCIA", 2.9999)).toBe("CERCA");
    expect(rango("REGLA_DISTANCIA", 3)).toBe("EN_RANGO");
    expect(rango("REGLA_DISTANCIA", 5)).toBe("EN_RANGO");
    expect(rango("REGLA_DISTANCIA", 5.0001)).toBeNull();
  });
  it("se compara el valor redondeado como las observaciones", () => {
    expect(rango("PESO_ESPECIE", 0.25 + 1e-12)).toBeNull();
    expect(rango("PUNTO_CONTRIBUCION_RIESGO", 0.6 / 0.4 - 1e-15)).toBe("DESPROPORCIONADA");
  });
  it("los límites inferiores son las constantes del catálogo", () => {
    expect(TRAMOS.PESO_ESPECIE[0]!.limite).toBe(UMBRAL_PESO_PRIMERA);
    expect(TRAMOS.PUNTO_CONTRIBUCION_RIESGO[0]!.limite).toBe(FACTOR_CONTRIBUCION_DESPROPORCIONADA);
    expect(TRAMOS.REGLA_DISTANCIA[0]!.limite).toBe(UMBRAL_REGLA_CERCANA_PCT);
    expect(CONTRIBUCION_MINIMA).toBe(0.1);
  });
  it("la importancia sigue la tabla", () => {
    expect(importanciaDe("PESO_ESPECIE", "ELEVADO")).toBe("MEDIA");
    expect(importanciaDe("PESO_ESPECIE", "MUY_ELEVADO")).toBe("ALTA");
    expect(importanciaDe("PUNTO_CONCENTRACION", "ELEVADA")).toBe("MEDIA");
    expect(importanciaDe("PUNTO_EFECTO_CAIDA", "MEDIANO")).toBe("BAJA");
    expect(importanciaDe("PROBABILIDAD_BAJO_APORTADO", "ELEVADA")).toBe("MEDIA");
    expect(importanciaDe("REGLA_TOCADA", "TOCADA")).toBe("ALTA");
    expect(importanciaDe("REGLA_EN_EL_NIVEL", "EN_EL_NIVEL")).toBe("ALTA");
    expect(importanciaDe("REGLA_DISTANCIA", "MUY_CERCA")).toBe("ALTA");
    expect(importanciaDe("REGLA_DISTANCIA", "CERCA")).toBe("MEDIA");
    expect(importanciaDe("REGLA_DISTANCIA", "EN_RANGO")).toBe("BAJA");
  });
});

describe("rango ajeno", () => {
  it("la importancia de un rango que no es de la clave es un error", () => {
    expect(() => importanciaDe("PESO_ESPECIE", "GRANDE")).toThrow(RangeError);
  });
});

describe("códigos y lenguaje", () => {
  const codigos = [...CLAVES_PUNTO, ...CLAVES_PUNTO.flatMap((c) => TRAMOS[c].map((t) => t.rango))];
  it("solo letras mayúsculas y guion bajo, sin dígitos ni palabras de otros catálogos", () => {
    for (const c of codigos) {
      expect(c).toMatch(/^[A-Z_]+$/);
      expect(c).not.toMatch(/SENAL|PRIMERA|TRES/);
    }
  });
  it("ningún código usa lenguaje de consejo (con control positivo)", () => {
    expect(prohibidasEn(codigos.join(" ").replace(/_/g, " "))).toEqual([]);
    expect(prohibidasEn("le conviene")).not.toEqual([]);
  });
});

describe("pureza del módulo", () => {
  it("sin reloj, azar, red ni base", () => {
    const dir = new URL("../../../../src/analisis/puntos/", import.meta.url);
    const archivos = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(archivos.length).toBeGreaterThan(0);
    for (const f of archivos) {
      const t = readFileSync(new URL(f, dir), "utf8");
      expect(t, f).not.toMatch(/Date\.now|new Date\(|Math\.random|fetch\(|process\.|server-only|@\/lib\/db|PrismaClient/);
    }
  });
});
