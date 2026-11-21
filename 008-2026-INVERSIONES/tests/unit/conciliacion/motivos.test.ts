/**
 * Motivos de la conciliación en español claro para el dueño (PR-C, GATE 1 aprobada):
 * - una frase por cada código que puede escribir el cálculo (el candado los saca del código de controles.ts);
 * - tres casos se muestran como «No se pudo verificar» y dicen qué falta;
 * - sin comandos ni jerga en la pantalla, y nunca una recomendación de comprar o vender;
 * - un código que la pantalla no conoce no la rompe ni se repite en pantalla.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOTIVOS, SIN_VERIFICAR, estadoDeControl, fraseDeMotivo, textoDeResultadoGlobal } from "@/app/conciliacion/motivos";

const FUENTE = readFileSync(new URL("../../../src/conciliacion/controles.ts", import.meta.url), "utf8");
/** Los literales «palabra_palabra» del cálculo, menos el alcance del total (no es un motivo). */
const CODIGOS_DEL_CALCULO = new Set([...FUENTE.matchAll(/"([a-z]+(?:_[a-z0-9]+)+)"/g)].map((m) => m[1]!).filter((c) => c !== "total_acciones"));

describe("MOTIVOS", () => {
  it("el candado encuentra los códigos del cálculo (si no, no probaría nada)", () => {
    expect(CODIGOS_DEL_CALCULO.size).toBeGreaterThanOrEqual(16);
    expect(CODIGOS_DEL_CALCULO).toContain("fondo_sin_unidades");
  });

  it("hay una frase para cada código que escribe el cálculo, y ninguna de más", () => {
    expect(new Set(Object.keys(MOTIVOS))).toEqual(CODIGOS_DEL_CALCULO);
  });

  it("las frases son claras: sin comandos, sin códigos y sin recomendar comprar ni vender", () => {
    for (const [codigo, frase] of Object.entries(MOTIVOS)) {
      expect(frase, codigo).toMatch(/^[A-ZÁÉÍÓÚÑ].*\.$/);
      expect(frase, codigo).not.toMatch(/npm|npx|tsx|scripts\/|--|`|_/);
      expect(frase, codigo).not.toMatch(/\b(compre|compren|venda|vendan|recomend\w*)\b/i);
    }
  });

  it("los tres casos sin dato se muestran como «No se pudo verificar» y dicen qué falta", () => {
    expect([...SIN_VERIFICAR].sort()).toEqual(["fondo_sin_unidades", "sin_precio_al_corte", "sin_valor_unidad_al_corte"]);
    for (const codigo of SIN_VERIFICAR) {
      expect(MOTIVOS[codigo]).toMatch(/\bfalta\b/);
      expect(estadoDeControl("NO_CUADRA", codigo)).toEqual({ texto: "No se pudo verificar", tono: "sin-verificar" });
    }
    expect(MOTIVOS.fondo_sin_unidades).toMatch(/unidades del fondo/);
    expect(MOTIVOS.sin_precio_al_corte).toMatch(/precio de cierre/);
  });
});

describe("fraseDeMotivo", () => {
  it("sin motivo no hay frase; un código conocido da su frase", () => {
    expect(fraseDeMotivo(null)).toBeNull();
    expect(fraseDeMotivo("t_mas_2")).toBe(MOTIVOS.t_mas_2);
  });

  it("un código que la pantalla no conoce da una frase fija, sin repetir el código", () => {
    for (const raro of ["motivo_nuevo", "toString", "__proto__", "constructor", ""]) {
      const frase = fraseDeMotivo(raro);
      expect(frase, raro).toBe("Hay un motivo que esta pantalla todavía no sabe explicar.");
    }
  });
});

describe("estadoDeControl y textoDeResultadoGlobal", () => {
  it("cada resultado de un control tiene su texto y su tono", () => {
    expect(estadoDeControl("CUADRA", null)).toEqual({ texto: "Cuadra", tono: "cuadra" });
    expect(estadoDeControl("NO_CUADRA", "diferencia_cantidad")).toEqual({ texto: "No cuadra", tono: "no-cuadra" });
    expect(estadoDeControl("PENDIENTE_LIQUIDACION", "t_mas_2")).toEqual({ texto: "Por liquidar", tono: "por-liquidar" });
  });

  it("un resultado de control desconocido no rompe la pantalla", () => {
    expect(estadoDeControl("OTRO", null)).toEqual({ texto: "Sin clasificar", tono: "sin-verificar" });
  });

  it("el resultado global se dice en palabras", () => {
    expect(textoDeResultadoGlobal("CUADRA")).toBe("Cuadra");
    expect(textoDeResultadoGlobal("NO_CUADRA")).toBe("No cuadra");
    expect(textoDeResultadoGlobal("PARCIAL")).toBe("Cuadra, con operaciones por liquidar");
  });
});
