// El catálogo cerrado de los puntos para revisar es un contrato con la pantalla y con la IA: claves, umbrales y unidades
// exactos. Puro.
import { describe, expect, it } from "vitest";
import {
  CLAVES_OBSERVACION, CONTRIBUCION_MINIMA, DIAS_HISTORIA_SUFICIENTE, MINIMO_ESPECIES_TOP_TRES, UMBRALES, UNIDADES,
} from "@/analisis/catalogo";
import { MINIMO_DIAS } from "@/proyecciones/metodo";

describe("catálogo de observaciones", () => {
  it("las claves, en su orden", () => {
    expect(CLAVES_OBSERVACION).toEqual([
      "CONCENTRACION_ALTA", "CONCENTRACION_TOP_TRES", "CORRELACION_ALTA", "CONTRIBUCION_RIESGO_DESPROPORCIONADA",
      "REGLA_CUMPLIDA", "REGLA_CERCANA", "REGLA_VENCE_PRONTO", "REGLA_VENCIDA",
      "PRECIO_ATRASADO", "PRECIOS_SIN_ACTUALIZAR", "DECISION_RESULTADO_NEGATIVO", "EX_DIVIDENDO_PRONTO", "HISTORIA_INSUFICIENTE",
    ]);
  });

  it("los umbrales y sus unidades", () => {
    expect(UMBRALES).toEqual({
      CONCENTRACION_ALTA: 0.25, CONCENTRACION_TOP_TRES: 0.6, CORRELACION_ALTA: 0.8, CONTRIBUCION_RIESGO_DESPROPORCIONADA: 1.5,
      REGLA_CUMPLIDA: 0, REGLA_CERCANA: 5, REGLA_VENCE_PRONTO: 14, REGLA_VENCIDA: 1, PRECIO_ATRASADO: 1, PRECIOS_SIN_ACTUALIZAR: 1,
      DECISION_RESULTADO_NEGATIVO: 30, EX_DIVIDENDO_PRONTO: 14, HISTORIA_INSUFICIENTE: 250,
    });
    expect(UNIDADES).toEqual({
      CONCENTRACION_ALTA: "FRACCION", CONCENTRACION_TOP_TRES: "FRACCION", CORRELACION_ALTA: "CORRELACION", CONTRIBUCION_RIESGO_DESPROPORCIONADA: "VECES",
      REGLA_CUMPLIDA: "PORCENTAJE", REGLA_CERCANA: "PORCENTAJE", REGLA_VENCE_PRONTO: "DIAS", REGLA_VENCIDA: "DIAS", PRECIO_ATRASADO: "RUEDAS",
      PRECIOS_SIN_ACTUALIZAR: "RUEDAS", DECISION_RESULTADO_NEGATIVO: "DIAS", EX_DIVIDENDO_PRONTO: "DIAS", HISTORIA_INSUFICIENTE: "DIAS",
    });
    expect(Object.keys(UMBRALES)).toEqual([...CLAVES_OBSERVACION]);
    expect(Object.keys(UNIDADES)).toEqual([...CLAVES_OBSERVACION]);
  });

  it("los umbrales auxiliares y el de historia, tomado de las proyecciones (no copiado)", () => {
    expect(MINIMO_ESPECIES_TOP_TRES).toBe(4);
    expect(CONTRIBUCION_MINIMA).toBe(0.1);
    expect(DIAS_HISTORIA_SUFICIENTE).toBe(MINIMO_DIAS);
  });

  it("no se pueden cambiar en ejecución", () => {
    expect(Object.isFrozen(UMBRALES)).toBe(true);
    expect(Object.isFrozen(UNIDADES)).toBe(true);
  });
});
