// El catálogo cerrado de los puntos para revisar es un contrato con la pantalla y con la IA: claves y criterios exactos
// (umbral, unidad, comparación y umbrales auxiliares), en un solo registro. Puro.
import { describe, expect, expectTypeOf, it } from "vitest";
import { CLAVES_OBSERVACION, CONTRIBUCION_MINIMA, CRITERIOS, DIAS_HISTORIA_SUFICIENTE, MINIMO_ESPECIES_TOP_TRES, type ClaveObservacion, type Observacion } from "@/analisis/catalogo";
import { MINIMO_DIAS } from "@/proyecciones/metodo";

describe("catálogo de observaciones", () => {
  it("las claves, en su orden", () => {
    expect(CLAVES_OBSERVACION).toEqual([
      "CONCENTRACION_ALTA", "CONCENTRACION_TOP_TRES", "CORRELACION_ALTA", "CONTRIBUCION_RIESGO_DESPROPORCIONADA",
      "REGLA_CUMPLIDA", "REGLA_CERCANA", "REGLA_VENCE_PRONTO", "REGLA_VENCIDA",
      "PRECIO_ATRASADO", "PRECIOS_SIN_ACTUALIZAR", "DECISION_RESULTADO_NEGATIVO", "EX_DIVIDENDO_PRONTO", "HISTORIA_INSUFICIENTE",
    ]);
  });

  it("cada clave con su criterio completo, en un solo registro", () => {
    expect(CRITERIOS).toEqual({
      CONCENTRACION_ALTA: { umbral: 0.25, unidad: "FRACCION", comparacion: "MAYOR_QUE", auxiliares: {} },
      CONCENTRACION_TOP_TRES: { umbral: 0.6, unidad: "FRACCION", comparacion: "MAYOR_QUE", auxiliares: { minimoEspecies: 4 } },
      CORRELACION_ALTA: { umbral: 0.8, unidad: "CORRELACION", comparacion: "MAYOR_O_IGUAL", auxiliares: {} },
      CONTRIBUCION_RIESGO_DESPROPORCIONADA: { umbral: 1.5, unidad: "VECES", comparacion: "MAYOR_O_IGUAL", auxiliares: { contribucionMinima: 0.1 } },
      REGLA_CUMPLIDA: { umbral: 0, unidad: "PORCENTAJE", comparacion: "PASA_EL_NIVEL", auxiliares: {} },
      REGLA_CERCANA: { umbral: 5, unidad: "PORCENTAJE", comparacion: "VALOR_ABSOLUTO_HASTA", auxiliares: {} },
      REGLA_VENCE_PRONTO: { umbral: 14, unidad: "DIAS", comparacion: "DE_CERO_HASTA", auxiliares: {} },
      REGLA_VENCIDA: { umbral: 1, unidad: "DIAS", comparacion: "MAYOR_O_IGUAL", auxiliares: {} },
      PRECIO_ATRASADO: { umbral: 1, unidad: "RUEDAS", comparacion: "MAYOR_O_IGUAL", auxiliares: {} },
      PRECIOS_SIN_ACTUALIZAR: { umbral: 1, unidad: "RUEDAS", comparacion: "MAYOR_O_IGUAL", auxiliares: {} },
      DECISION_RESULTADO_NEGATIVO: { umbral: 30, unidad: "DIAS", comparacion: "DE_CERO_HASTA", auxiliares: { resultadoPesosMenorQue: 0 } },
      EX_DIVIDENDO_PRONTO: { umbral: 14, unidad: "DIAS", comparacion: "DE_CERO_HASTA", auxiliares: {} },
      HISTORIA_INSUFICIENTE: { umbral: 250, unidad: "DIAS", comparacion: "MENOR_QUE", auxiliares: {} },
    });
    expect(Object.keys(CRITERIOS)).toEqual([...CLAVES_OBSERVACION]);
  });

  it("los umbrales auxiliares son las constantes nombradas, y el de historia sale de las proyecciones (no copiado)", () => {
    expect(CRITERIOS.CONCENTRACION_TOP_TRES.auxiliares.minimoEspecies).toBe(MINIMO_ESPECIES_TOP_TRES);
    expect(CRITERIOS.CONTRIBUCION_RIESGO_DESPROPORCIONADA.auxiliares.contribucionMinima).toBe(CONTRIBUCION_MINIMA);
    expect(DIAS_HISTORIA_SUFICIENTE).toBe(MINIMO_DIAS);
  });

  it("no se pueden cambiar en ejecución, ni el registro ni cada criterio", () => {
    expect(Object.isFrozen(CRITERIOS)).toBe(true);
    expect(Object.values(CRITERIOS).every((c) => Object.isFrozen(c) && Object.isFrozen(c.auxiliares))).toBe(true);
  });

  it("la unión de observaciones cubre exactamente las claves del catálogo (se verifica al compilar)", () => {
    expectTypeOf<Observacion["clave"]>().toEqualTypeOf<ClaveObservacion>();
    expectTypeOf<Extract<Observacion, { clave: "CONCENTRACION_TOP_TRES" }>["datos"]["instrumentoIds"]>().toEqualTypeOf<readonly [string, string, string]>();
  });
});
