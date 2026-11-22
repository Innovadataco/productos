// Propiedades del análisis con semilla (crearPrng, sin modificar), sobre la salida ya redondeada: las contribuciones
// suman la volatilidad del portafolio dentro de toleranciaSuma(K), la correlación queda en [−1, 1] con la diagonal en
// 1 y el HHI en [1/n, 1]. Puro.
import { describe, expect, it } from "vitest";
import { analizar } from "@/analisis/analizar";
import { toleranciaSuma } from "@/analisis/riesgo";
import { crearPrng } from "@/proyecciones/prng";
import { diasHabiles, portafolio, serieDeRetornos, type EspecieFicticia } from "./fixtures/portafolio.ficticio";

const DIAS = diasHabiles("2019-01-02", 271);

function especies(semilla: number): EspecieFicticia[] {
  const p = crearPrng(semilla);
  const K = 1 + p.enteroMenorQue(6);
  const comun = Array.from({ length: DIAS.length - 1 }, () => (p.uniforme() - 0.5) * 0.024);
  return Array.from({ length: K }, (_, k) => {
    const beta = (p.uniforme() - 0.3) * 2;
    const retornos = comun.map((f) => beta * f + (p.uniforme() - 0.5) * 0.03);
    return { id: `FICTICIA-${String.fromCharCode(65 + k)}`, cantidad: 3 + p.enteroMenorQue(4999), cierres: serieDeRetornos(DIAS, 100 + p.uniforme() * 9000, retornos) };
  });
}

describe("propiedades del análisis (20 semillas)", () => {
  for (let semilla = 1; semilla <= 20; semilla += 1) {
    it(`semilla ${semilla}`, () => {
      const lista = especies(semilla);
      const a = analizar(portafolio(lista));
      if (a.riesgo.estado !== "CALCULADO") throw new Error("debía calcularse");
      const K = lista.length;
      const contribuciones = a.especies.map((e) => (e.riesgo.estado === "CUBIERTA" ? e.riesgo.contribucion : null));
      expect(contribuciones.every((c) => c !== null)).toBe(true);
      const suma = contribuciones.reduce((s, c) => s + c!.contribucion, 0);
      const pct = contribuciones.reduce((s, c) => s + c!.contribucionPct, 0);
      expect(Math.abs(suma - a.riesgo.volatilidadAnual)).toBeLessThanOrEqual(toleranciaSuma(K));
      expect(Math.abs(pct - 1)).toBeLessThanOrEqual(toleranciaSuma(K));
      a.riesgo.correlacion.valores.forEach((fila, i) =>
        fila.forEach((r, j) => {
          expect(r).not.toBeNull();
          if (i === j) expect(r).toBe(1);
          expect(r!).toBeGreaterThanOrEqual(-1);
          expect(r!).toBeLessThanOrEqual(1);
          expect(r).toBe(a.riesgo.estado === "CALCULADO" ? a.riesgo.correlacion.valores[j]![i] : null);
        }),
      );
      expect(a.concentracion!.hhi).toBeGreaterThanOrEqual(1 / K - 1e-8);
      expect(a.concentracion!.hhi).toBeLessThanOrEqual(1);
    });
  }
});
