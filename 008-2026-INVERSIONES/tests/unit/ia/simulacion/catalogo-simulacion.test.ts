/**
 * El catálogo de SIMULACION (decisión 3 de la compuerta): las claves de los puntos del paso 1 con su rango. Los rangos y su
 * importancia se derivan de `TRAMOS` (src/analisis/puntos/rangos.ts): no se escriben aparte. Las etiquetas no llevan
 * «orden», «operación», «posición», «compr…» ni «vend…» (ni «sin vender»), El nombre de la especie entra a la vista solo como id, clave y etiqueta (nunca el valor), como en DIARIO.
 */
import { describe, expect, it } from "vitest";
import { TRAMOS } from "@/analisis/puntos/rangos";
import { CATALOGO, clavesDe, entradaDeCatalogo, importanciaDeRango, rangosDe } from "@/ia/catalogo";
import { TIPOS_DIARIOS, UNIDADES } from "@/ia/contrato";

const CLAVES = ["ESPECIE_NOMBRE", "PESO_ESPECIE", "PUNTO_CONCENTRACION", "PUNTO_CONTRIBUCION_RIESGO", "PUNTO_EFECTO_CAIDA", "PROBABILIDAD_BAJO_APORTADO", "PUNTO_NIVEL_REGLA", "REGLA_DEL_PLAN"];
const PUNTOS = CLAVES.filter((c) => c !== "ESPECIE_NOMBRE" && c !== "REGLA_DEL_PLAN");
const TRAMOS_DE: Readonly<Record<string, readonly (keyof typeof TRAMOS)[]>> = {
  PESO_ESPECIE: ["PESO_ESPECIE"], PUNTO_CONCENTRACION: ["PUNTO_CONCENTRACION"], PUNTO_CONTRIBUCION_RIESGO: ["PUNTO_CONTRIBUCION_RIESGO"],
  PUNTO_EFECTO_CAIDA: ["PUNTO_EFECTO_CAIDA"], PROBABILIDAD_BAJO_APORTADO: ["PROBABILIDAD_BAJO_APORTADO"],
  PUNTO_NIVEL_REGLA: ["REGLA_TOCADA", "REGLA_EN_EL_NIVEL", "REGLA_DISTANCIA"],
};

describe("catálogo de SIMULACION", () => {
  it("tiene exactamente las claves de la decisión 3, congelado", () => {
    expect([...clavesDe("SIMULACION")]).toEqual(CLAVES);
    expect(Object.isFrozen(CATALOGO.SIMULACION)).toBe(true);
    for (const entrada of Object.values(CATALOGO.SIMULACION)) expect(Object.isFrozen(entrada)).toBe(true);
  });

  it.each(Object.entries(TRAMOS_DE))("%s: sus rangos y su importancia salen de TRAMOS, sin repetir", (clave, claves) => {
    const tramos = claves.flatMap((c) => TRAMOS[c]);
    expect([...rangosDe("SIMULACION", clave)].sort()).toEqual(tramos.map((t) => t.rango).sort());
    for (const tramo of tramos) expect(importanciaDeRango("SIMULACION", clave, tramo.rango), `${clave} ${tramo.rango}`).toBe(tramo.importancia);
    expect(new Set(rangosDe("SIMULACION", clave)).size).toBe(rangosDe("SIMULACION", clave).length);
  });

  it("los rangos de PUNTO_NIVEL_REGLA son los cinco de la regla; un rango de otra clave no vale", () => {
    expect([...rangosDe("SIMULACION", "PUNTO_NIVEL_REGLA")].sort()).toEqual(["CERCA", "EN_EL_NIVEL", "EN_RANGO", "MUY_CERCA", "TOCADA"]);
    expect(importanciaDeRango("SIMULACION", "PESO_ESPECIE", "TOCADA")).toBeNull();
    expect(importanciaDeRango("SIMULACION", "ESPECIE_NOMBRE", "ELEVADO")).toBeNull();
    expect(importanciaDeRango("SIMULACION", "NO_EXISTE", "ELEVADO")).toBeNull();
    expect(rangosDe("SIMULACION", "NO_EXISTE")).toEqual([]);
  });

  it("los códigos de rango no llevan dígitos y son de la lista cerrada del paso 1", () => {
    for (const clave of PUNTOS) for (const rango of rangosDe("SIMULACION", clave)) expect(rango).toMatch(/^[A-Z_]+$/u);
  });

  it("las unidades son del contrato: VECES para la contribución y PUNTOS para la concentración", () => {
    for (const entrada of Object.values(CATALOGO.SIMULACION)) expect(UNIDADES).toContain(entrada.unidad);
    expect(CATALOGO.SIMULACION.PUNTO_CONTRIBUCION_RIESGO.unidad).toBe("VECES");
    expect(CATALOGO.SIMULACION.PUNTO_CONCENTRACION.unidad).toBe("PUNTOS");
    expect(CATALOGO.SIMULACION.ESPECIE_NOMBRE.unidad).toBe("NOMBRE");
  });

  it("las etiquetas no llevan orden, operación, posición, compr…, vend…, «sin vender» ni dígitos", () => {
    for (const [clave, entrada] of Object.entries(CATALOGO.SIMULACION)) {
      const etiqueta = entrada.etiqueta.toLowerCase();
      expect(etiqueta, clave).not.toMatch(/\b(?:orden|ordenes|operaci[oó]n|posici[oó]n)\b|compr|vend|sin vender|\p{N}/u);
    }
  });

  it("solo los puntos llevan rango; el nombre de la especie y el ancla de la regla no", () => {
    expect(entradaDeCatalogo("SIMULACION", "ESPECIE_NOMBRE")?.rangos).toEqual([]);
    expect(entradaDeCatalogo("SIMULACION", "REGLA_DEL_PLAN")?.rangos).toEqual([]);
    for (const clave of PUNTOS) expect(rangosDe("SIMULACION", clave).length, clave).toBeGreaterThan(0);
  });

  it("cada punto de una especie lleva el sujeto EXIGIDO (el código pone el nombre en la referencia); los del portafolio, ninguno", () => {
    for (const clave of ["PESO_ESPECIE", "PUNTO_CONTRIBUCION_RIESGO", "PUNTO_EFECTO_CAIDA", "PUNTO_NIVEL_REGLA"]) expect(entradaDeCatalogo("SIMULACION", clave)?.politicaSujeto, clave).toBe("EXIGIDO");
    for (const clave of ["PUNTO_CONCENTRACION", "PROBABILIDAD_BAJO_APORTADO", "ESPECIE_NOMBRE"]) expect(entradaDeCatalogo("SIMULACION", clave)?.politicaSujeto, clave).toBe("NINGUNO");
    expect(entradaDeCatalogo("SIMULACION", "REGLA_DEL_PLAN")?.politicaSujeto).toBe("OPCIONAL");
  });

  it("los tres tipos de hoy no llevan rangos", () => {
    for (const tipo of TIPOS_DIARIOS) {
      for (const [clave, entrada] of Object.entries(CATALOGO[tipo])) {
        expect(entrada.rangos, `${tipo} ${clave}`).toEqual([]);
      }
    }
  });
});
