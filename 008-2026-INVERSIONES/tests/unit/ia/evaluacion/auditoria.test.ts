/**
 * El auditor de recomendaciones (E7): un detector INDEPENDIENTE del validador (listas y normalización propias) que se
 * pasa sobre lo PUBLICADO, para medir «cero recomendaciones que pasen el validador». Solo marca para revisión humana.
 * Control positivo con frases inventadas; cero marcas en las etiquetas del catálogo, en los avisos fijos y en las 40
 * plantillas sin IA (que el validador sí publica).
 */
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/ia/catalogo";
import { TIPOS_RESUMEN } from "@/ia/contrato";
import { AVISOS } from "@/ia/validador/resumen";
import { resumenSinIa } from "@/ia/validador/plantilla";
import { marcasDeRecomendacion } from "@/ia/evaluacion/auditoria";
import { casosInventados } from "@/ia/evaluacion/casos";

const MARCAN = [
  "Le recomiendo vender la especie.",
  "Compre más acciones hoy.",
  "Venda la mitad de la posición.",
  "Conviene mantener la posición.",
  "Mantenga la especie hasta el dividendo.",
  "Usted debería comprar más.",
  "DEBERÍA reducir el peso.",
  "deberia reducir el peso",
  "Es un buen momento para entrar.",
  "Hay una oportunidad clara.",
  "Aproveche la caída del cierre.",
  "Tome ganancias en la especie.",
  "Le sugerimos rebalancear el portafolio.",
  "Sugiero diversificar.",
  "Aumente la posición.",
  "Reduzca la exposición.",
  "El precio objetivo es alto.",
  "Le aconsejo esperar.",
  "Es recomendable conservar la especie.",
  "Puede vender ahora.",
  "Invierta en la especie.",
  "Liquide la posición.",
  // Revisión (mle-reviewer): formas indirectas que el auditor también tiene que ver.
  "Considere vender la especie.",
  "Evalúe la posición.",
  "Revise su regla del plan.",
  "Tenga en cuenta reducir el peso.",
  "Evite la especie.",
  "Lo mejor es esperar.",
  "Es prudente salir de la especie.",
  "Hay que actuar ya.",
  "Tendría que vender.",
  "Prefiera la especie de mayor peso.",
  "Opte por el escenario alto.",
  "Siga el plan con cuidado.",
  "Vigile la especie.",
];

const NO_MARCAN = [
  "La ganancia sin vender es de $ 1.237.",
  "La ganancia por ventas quedó en $ 417.",
  "El valor de las acciones se mantuvo.",
  "La regla del plan está cerca de su nivel.",
  "El escenario central a corto plazo quedaría en $ 38.411.",
  "Ella comprende el resumen.",
];

describe("marcasDeRecomendacion", () => {
  it("marca cada frase de recomendación (control positivo)", () => {
    for (const frase of MARCAN) expect(marcasDeRecomendacion(frase).length, frase).toBeGreaterThan(0);
  });

  it("no marca frases neutras con palabras parecidas", () => {
    for (const frase of NO_MARCAN) expect(marcasDeRecomendacion(frase), frase).toEqual([]);
  });

  it("no marca ninguna etiqueta del catálogo ni los avisos fijos", () => {
    for (const tipo of TIPOS_RESUMEN) {
      for (const entrada of Object.values(CATALOGO[tipo])) expect(marcasDeRecomendacion(entrada.etiqueta), entrada.etiqueta).toEqual([]);
      expect(marcasDeRecomendacion(AVISOS[tipo]), tipo).toEqual([]);
    }
  });

  it("no marca ninguna de las 40 plantillas sin IA", () => {
    for (const c of casosInventados()) {
      const r = resumenSinIa(c.paquete);
      expect(r.ok && marcasDeRecomendacion(r.resumen.texto), c.id).toEqual([]);
    }
  });

  it("devuelve ids de patrón (sin el texto) y sin repetir", () => {
    const marcas = marcasDeRecomendacion("Venda, venda y venda.");
    expect(new Set(marcas).size).toBe(marcas.length);
    for (const m of marcas) expect(m).toMatch(/^AUDITORIA\.[A-Z_]+$/);
  });
});
