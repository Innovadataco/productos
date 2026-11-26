/**
 * Los 40 casos INVENTADOS del arnés (E7): 15 DIARIO, 15 REGLAS y 10 ESCENARIOS, armados con los armadores reales de E1b
 * desde entradas con semilla fija. Especies FICTICIA-*, días de 2027 (la ventana de la proyección puede empezar antes de
 * 2022) y cifras no redondas. Cada caso es distinto PARA EL MODELO (su vista ciega cambia, no solo los números).
 */
import { describe, expect, it } from "vitest";
import type { Hecho } from "@/ia/contrato";
import { armarPedido } from "@/ia/generador";
import { jsonCanonico } from "@/ia/hash";
import { ESQUEMA_SALIDA } from "@/ia/prompts/esquema";
import { promptDe } from "@/ia/prompts/prompts";
import { resumenSinIa } from "@/ia/validador/plantilla";
import { vistaCiega } from "@/ia/vista-ciega";
import { casosInventados, hashDeCasos, limitarCasos } from "@/ia/evaluacion/casos";
import { CANTIDAD_INVENTADOS, SEMILLA_INVENTADOS } from "@/ia/evaluacion/inventados.ficticio";

const casos = casosInventados();
const hechos = (): readonly Hecho[] => casos.flatMap((c) => c.paquete.hechos);
const NUMERICAS = new Set(["PESOS", "PESOS_POR_DOLAR"]);

describe("casosInventados", () => {
  it("son 42: 17 DIARIO, 15 REGLAS y 10 ESCENARIOS, con ids estables y únicos", () => {
    expect(CANTIDAD_INVENTADOS).toEqual({ DIARIO: 17, REGLAS: 15, ESCENARIOS: 10 });
    expect(casos).toHaveLength(42);
    expect(casos.filter((c) => c.tipo === "DIARIO")).toHaveLength(17);
    expect(casos.filter((c) => c.tipo === "REGLAS")).toHaveLength(15);
    expect(casos.filter((c) => c.tipo === "ESCENARIOS")).toHaveLength(10);
    expect(casos.slice(0, 2).map((c) => c.id)).toEqual(["DIARIO-01", "DIARIO-02"]);
    expect(casos.at(-1)?.id).toBe("ESCENARIOS-10");
    expect(new Set(casos.map((c) => c.id)).size).toBe(42);
    for (const c of casos) expect(c.paquete.tipo).toBe(c.tipo);
  });

  it("la misma semilla da los mismos casos; otra semilla, otros", () => {
    expect(hashDeCasos(casosInventados(SEMILLA_INVENTADOS))).toBe(hashDeCasos(casos));
    expect(hashDeCasos(casosInventados(SEMILLA_INVENTADOS + 17))).not.toBe(hashDeCasos(casos));
    expect(hashDeCasos(casos)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("las 42 vistas ciegas son distintas (cambia la estructura, no solo los números)", () => {
    expect(new Set(casos.map((c) => jsonCanonico(vistaCiega(c.paquete)))).size).toBe(42);
  });

  it("especies FICTICIA-*, días de 2027 (la ventana puede empezar antes de 2022) y cifras no redondas", () => {
    const nombres = hechos().filter((h) => h.clave === "ESPECIE_NOMBRE").map((h) => h.valor);
    expect(nombres.length).toBeGreaterThan(40);
    for (const n of nombres) expect(n).toMatch(/^FICTICIA-[A-Z]+$/);
    for (const c of casos) expect(c.paquete.hoy.slice(0, 4)).toBe("2027");
    for (const h of hechos()) {
      if (h.clave === "VENTANA_DESDE") expect(h.fecha < "2022-01-01" || h.fecha.startsWith("2027"), h.clave).toBe(true);
      else expect(h.fecha.slice(0, 4), h.clave).toBe("2027");
      if (h.unidad === "FECHA" && h.clave !== "VENTANA_DESDE") expect(h.valor.slice(0, 4), h.clave).toBe("2027");
    }
    const redondas = hechos().filter((h) => NUMERICAS.has(h.unidad) && /^-?\d+$/.test(h.valor) && Math.abs(Number(h.valor)) >= 100 && Number(h.valor) % 100 === 0);
    expect(redondas.map((h) => h.valor)).toEqual([]);
  });

  it("cubren lo que el modelo tiene que saber decir: tocadas, cerca y lejos, dividendos, conciliación, fondo, resúmenes", () => {
    const claves = new Set(hechos().map((h) => h.clave));
    for (const clave of ["REGLA_TOCADA", "REGLA_DISTANCIA", "PROXIMO_EX_DIVIDENDO", "REGLA_DIAS_AL_PLAZO", "CONCILIACION_NO_CUADRA", "CONCILIACION_CUADRA", "FONDO_VALOR", "TASA_TRM", "VARIACION_DIA_ESPECIE", "DIAS_HISTORIA_ESPECIE"]) {
      expect(claves.has(clave as Hecho["clave"]), clave).toBe(true);
    }
    const distancias = hechos().filter((h) => h.clave === "REGLA_DISTANCIA");
    expect(distancias.some((h) => h.cercania === "CERCA")).toBe(true);
    expect(distancias.some((h) => h.cercania === "LEJOS")).toBe(true);
    expect(hechos().some((h) => h.frescura === "ATRASADO")).toBe(true);
    expect(casos.filter((c) => c.paquete.avisos.includes("ESPECIES_RESUMIDAS")).length).toBeGreaterThanOrEqual(2);
    expect(casos.filter((c) => c.paquete.avisos.includes("OBLIGATORIOS_RECORTADOS")).length).toBeGreaterThanOrEqual(1);
    // El DIARIO resume sus especies (T8): ya no llega al tope de 99 hechos; el más grande es de cincuenta y tantos y no pasa del tope.
    expect(Math.max(...casos.map((c) => c.paquete.hechos.length))).toBeGreaterThanOrEqual(50);
    expect(Math.max(...casos.map((c) => c.paquete.hechos.length))).toBeLessThanOrEqual(99);
    expect(Math.min(...casos.map((c) => c.paquete.hechos.length))).toBeLessThan(25);
  });

  it("cada caso arma su pedido (la vista pasa la guarda) y la plantilla sin IA publica los 42", () => {
    for (const c of casos) {
      expect(() => armarPedido({ paquete: c.paquete, prompt: promptDe(c.tipo), esquemaSalida: ESQUEMA_SALIDA, limiteMs: 120_000 }), c.id).not.toThrow();
      expect(resumenSinIa(c.paquete).ok, c.id).toBe(true);
    }
  });
});

describe("limitarCasos", () => {
  it("toma los primeros de cada tipo, intercalados, sin pasar del máximo", () => {
    expect(limitarCasos(casos, 6).map((c) => c.id)).toEqual(["DIARIO-01", "REGLAS-01", "ESCENARIOS-01", "DIARIO-02", "REGLAS-02", "ESCENARIOS-02"]);
    expect(limitarCasos(casos, 1).map((c) => c.id)).toEqual(["DIARIO-01"]);
    expect(limitarCasos(casos, 42)).toHaveLength(42);
    expect(limitarCasos(casos, 99)).toHaveLength(42);
  });

  it("con un máximo fuera de rango lanza RangeError", () => {
    expect(() => limitarCasos(casos, 0)).toThrow(RangeError);
    expect(() => limitarCasos(casos, 1.5)).toThrow(RangeError);
  });
});
