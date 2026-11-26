/**
 * ATRIBUCION conectado al validador, SOLO para SIMULACION (condición C2 de PI), como defensa adicional: la garantía de fondo
 * es el vocabulario cerrado. Aquí se abre el vocabulario a propósito (doble de `palabrasFueraDelVocabulario`) para probar
 * la capa sola: con ella, las atribuciones dan ATRIBUCION; sin ella (mutación), pasarían. También: «usted» con cualquier
 * verbo y «cierre(s)» después de un conector (solo SIMULACION), RECOMENDACION.ATENCION y el orden con CITA_PEGADA.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/ia/validador/vocabulario", async (importar) => {
  const real = await importar<typeof import("@/ia/validador/vocabulario")>();
  return { ...real, palabrasFueraDelVocabulario: () => [] as readonly string[] };
});

import { TIPOS_DIARIOS } from "@/ia/contrato";
import { construirPaquete } from "@/ia/paquete";
import { segmentosDe } from "@/ia/validador/segmentos";
import { validarSalida } from "@/ia/validador/validar";
import { entradaSimulacion, ENTRADAS_FICTICIAS } from "../apoyo/hechos.ficticio";
import { frase } from "../validador/apoyo/salidas.ficticio";

const paquete = construirPaquete(entradaSimulacion());
const resto = ["La contribución de la especie {ESPECIE_NOMBRE} al riesgo queda en {PUNTO_CONTRIBUCION_RIESGO}, mucho mayor que su peso.", "La cercanía al nivel de la regla de la especie {ESPECIE_NOMBRE} queda en {PUNTO_NIVEL_REGLA}, muy cerca de su nivel.", "La concentración del portafolio queda en {PUNTO_CONCENTRACION}, elevada."];
const salida = (primera: string): string => JSON.stringify({ frases: [primera, ...resto].map((p) => ({ segmentos: segmentosDe(frase(paquete, p).texto) })), revisar: [] });
const resultado = (primera: string) => validarSalida(salida(primera), paquete);
const motivos = (primera: string): readonly string[] => {
  const r = resultado(primera);
  return r.ok ? [] : r.motivos;
};

const CASOS_C2 = [
  "Al aumentar la posición, el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.",
  "Al reducir la posición, el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.",
  "Si compra, el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.",
  "Tras la venta, el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.",
  "Al sumar más, el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.",
  "Con la operación, el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.",
  "La orden deja el peso de la especie {ESPECIE_NOMBRE} en {PESO_ESPECIE}, muy elevado.",
  "Esta orden deja el peso de la especie {ESPECIE_NOMBRE} en {PESO_ESPECIE}, muy elevado.",
  "Antes era menor: el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.",
  "El peso de la especie pasa de leve a muy elevado en {PESO_ESPECIE}.",
  "Si usted cierra {PESO_ESPECIE}, el peso de la especie {ESPECIE_NOMBRE} queda muy elevado.",
  "Usted paga {PESO_ESPECIE}, y el peso de la especie {ESPECIE_NOMBRE} queda muy elevado.",
  "Con el cierre de {PESO_ESPECIE}, el peso de la especie {ESPECIE_NOMBRE} queda muy elevado.",
  "Usted mira {PESO_ESPECIE}, y el peso de la especie {ESPECIE_NOMBRE} queda muy elevado.",
];

describe("ATRIBUCION en SIMULACION (con el vocabulario abierto, la capa sola)", () => {
  it("control positivo: la frase descriptiva buena publica aun con el vocabulario abierto", () => {
    expect(resultado("El peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.").ok).toBe(true);
  });

  it.each(CASOS_C2)("«%s» da ATRIBUCION", (plantilla) => {
    expect(motivos(plantilla)).toContain("ATRIBUCION");
  });

  it("los motivos de ATRIBUCION salen en el orden del validador: FORMATO (la cita pegada) antes que ATRIBUCION", () => {
    const r = validarSalida(salida("Al aumentar el peso {PESO_ESPECIE}{PUNTO_CONCENTRACION}, queda muy elevado."), paquete);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivos).toEqual(expect.arrayContaining(["FORMATO", "ATRIBUCION"]));
    expect(r.motivos.indexOf("FORMATO")).toBeLessThan(r.motivos.indexOf("ATRIBUCION"));
    const patrones = r.hallazgos.map((h) => h.patron);
    expect(patrones.indexOf("FORMATO.CITA_PEGADA")).toBeGreaterThanOrEqual(0);
    expect(patrones.indexOf("FORMATO.CITA_PEGADA")).toBeLessThan(patrones.findIndex((p) => p.startsWith("ATRIBUCION.")));
  });

  it("RECOMENDACION.ATENCION («mire», «fíjese», «atención»…) se rechaza como RECOMENDACION, solo en SIMULACION", () => {
    for (const palabra of ["Mire", "Fíjese", "Atención", "Ojo", "Cuidado", "Tome nota", "Conviene"]) {
      expect(motivos(`${palabra}: el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.`), palabra).toContain("RECOMENDACION");
    }
  });

  it("ATRIBUCION también revisa los ítems de «Para revisar»", () => {
    const conItem = JSON.stringify({
      frases: [{ segmentos: segmentosDe(frase(paquete, "El peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.").texto) }, ...resto.map((p) => ({ segmentos: segmentosDe(frase(paquete, p).texto) }))],
      revisar: [{ segmentos: segmentosDe(frase(paquete, "Tras la venta {PESO_ESPECIE}").texto) }],
    });
    const r = validarSalida(conItem, paquete);
    expect(r.ok ? [] : r.motivos).toContain("ATRIBUCION");
  });
});

describe("ATRIBUCION solo en SIMULACION: los tres de hoy no cambian de conducta", () => {
  it.each(TIPOS_DIARIOS)("%s: una frase con «Tras la venta» no da ATRIBUCION (la rechazan sus controles de siempre, no esta capa)", (tipo) => {
    const p = construirPaquete(ENTRADAS_FICTICIAS[tipo]());
    const clave = p.hechos.find((h) => h.clave !== "ESPECIE_NOMBRE" && h.clave !== "REGLA_DEL_PLAN")?.clave as string;
    const r = validarSalida(JSON.stringify({ frases: [{ segmentos: segmentosDe(frase(p, `Antes, tras la venta, usted vio {${clave}}.`).texto) }] }), p);
    expect(r.ok ? [] : r.motivos).not.toContain("ATRIBUCION");
  });
});
