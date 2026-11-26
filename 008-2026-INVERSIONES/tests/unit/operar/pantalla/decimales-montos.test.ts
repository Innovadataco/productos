// Los decimales de /operar: los porcentajes de peso (antes y después, en la tabla de pesos y en el análisis) salen siempre
// con la MISMA cantidad de decimales (dos, con los ceros: «12,30 %», no «12,3 %»), y ningún monto en pesos sale con tres o
// más decimales (ni con cuatro, como la comisión de la base): las cifras de la simulación, los precios y los niveles usan
// el formato de pesos de la app. Datos inventados (FICTICIA-*, 2027).
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { aRespuestaSimulacion, textoPeso } from "@/app/operar/serializar-simulacion";
import { precio } from "@/app/_plan/formato";
import { hhiEs, pctEs, variacionEs } from "@/operar/analisis/texto";
import { simularOperacion } from "@/operar/simulador/simular";
import { textoPesos, textoPesosRedondos } from "@/operar/simulador/textos";
import type { EstadoSimulado } from "@/operar/simulador/tipos";
import { A, B, CONTEXTO, D, idDe, operacion, orden, posicion } from "../simulador/apoyo/estado.ficticio";

const PESO_2_DECIMALES = /^\d{1,3},\d{2} %$/;
/** Un monto en pesos con tres o más decimales: «$ 12,5988», «−$ 6.202,9244». */
const MONTO_CON_DECIMALES = /\$ [\d.]+,\d{3,}/;

describe("los porcentajes de peso llevan siempre dos decimales", () => {
  it.each([
    ["12.3", "12,30 %"],
    ["10", "10,00 %"],
    ["99.999", "100,00 %"],
    ["0.5", "0,50 %"],
    ["52.37", "52,37 %"],
  ])("textoPeso(%s) = %s", (peso, esperado) => {
    expect(textoPeso({ cantidad: 1n, valoracion: { estado: "VALORADA", valor: D("1"), pesoPct: D(peso) } })).toBe(esperado);
  });

  it("el análisis: pctEs y variacionEs con dos decimales y los ceros; el HHI, con tres", () => {
    expect(pctEs(0.2113)).toBe("21,13 %");
    expect(pctEs(0.21)).toBe("21,00 %");
    expect(pctEs(0.2)).toBe("20,00 %");
    expect(pctEs(1)).toBe("100,00 %");
    expect(variacionEs(100, 100.5)).toBe("+0,50 %");
    expect(variacionEs(100, 90)).toBe("−10,00 %");
    expect(variacionEs(100, 100)).toBe("0,00 %");
    expect(hhiEs(0.25)).toBe("0,250");
  });

  it("en una simulación completa, todos los pesos (antes y después) tienen dos decimales", () => {
    const estado: EstadoSimulado = { posiciones: [posicion(A, 10n, "100"), posicion(B, 10n, "150")], caja: D("1000"), reglas: [] };
    const r = aRespuestaSimulacion(simularOperacion(estado, operacion(A, "COMPRAR", 5n, "100"), { ...CONTEXTO, ordenes: [] }), idDe(A), estado.posiciones, "ESCRITA");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pesos = r.vista.especies.flatMap((e) => [e.pesoAntes, e.pesoDespues]);
    expect(pesos).toEqual(["40,00 %", "50,00 %", "60,00 %", "50,00 %"]);
    for (const p of pesos) expect(p).toMatch(PESO_2_DECIMALES);
  });
});

describe("ningún monto en pesos sale con más de dos decimales", () => {
  it("textoPesos, textoPesosRedondos y precio() de la app redondean a dos decimales como máximo", () => {
    expect(textoPesos(D("-6202.9244"))).toBe("−$ 6.202,92");
    expect(textoPesos(D("12.5988"))).toBe("$ 12,6");
    expect(textoPesos(D("4600.130000"))).toBe("$ 4.600,13");
    expect(textoPesos(D("0.0000001"))).toBe("$ 0");
    expect(textoPesos(D("-0.0001"))).toBe("$ 0");
    expect(textoPesosRedondos(D("24021.7077"))).toBe("$ 24.022");
    expect(precio("6202.9244")).toBe("$ 6.202,92");
    expect(precio("4597.310000")).toBe("$ 4.597,31");
    for (const v of ["4613.27", "11.71", "461337.41", "0.000001", "823.19", "37911.47", "1237", "913711.4613", "6202.9244"]) {
      expect(textoPesos(D(v)), v).toBe(precio(v));
    }
  });

  it("el nivel de una regla con 6 decimales sale con dos (la regla que la orden toca)", () => {
    const estado: EstadoSimulado = {
      posiciones: [posicion(A, 1237n, "4613.274561")],
      caja: D("6202.9244"),
      reglas: [{ id: "r", instrumentoId: idDe(A), condicion: "CIERRE_BAJO", nivel: D("4600.130456"), accion: "VENDER", cantidad: 41n, plazoHasta: null, detalle: "texto ficticio del plan" }],
    };
    const r = aRespuestaSimulacion(simularOperacion(estado, operacion(A, "COMPRAR", 3n, "4613.27456"), { ...CONTEXTO, ordenes: [] }), idDe(A), estado.posiciones, "ESCRITA");
    expect(r.ok && r.vista.reglas.map((x) => x.texto)).toEqual(["Su regla de FICTICIA-A dice: vender 41 si el cierre queda por debajo de $ 4.600,13."]);
  });

  it("una simulación con cifras de 4 y 6 decimales (caja de la base, cierres de Yahoo, comisión de la historia) no los muestra", () => {
    const estado: EstadoSimulado = {
      posiciones: [posicion(A, 1237n, "4613.274561"), posicion(B, 379n, "11.7123")],
      caja: D("6202.9244"),
      reglas: [{ id: "r", instrumentoId: idDe(A), condicion: "CIERRE_BAJO", nivel: D("4600.130456"), accion: "VENDER", cantidad: 41n, plazoHasta: null, detalle: "texto ficticio del plan" }],
    };
    const contexto = { ...CONTEXTO, ordenes: [orden("COMPRA", "1237.6", "77.3512"), orden("COMPRA", "4613.12", "288.3217")] };
    for (const lado of ["COMPRAR", "VENDER"] as const) {
      const r = aRespuestaSimulacion(simularOperacion(estado, operacion(A, lado, 3n, "4613.27456"), contexto), idDe(A), estado.posiciones, "ESCRITA");
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const texto = JSON.stringify(r.vista);
      expect(texto).not.toMatch(MONTO_CON_DECIMALES);
    }
  });
});
