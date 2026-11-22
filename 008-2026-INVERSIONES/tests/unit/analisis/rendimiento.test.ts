// Tiempo del motor de análisis con un portafolio grande inventado (13 especies, unos 10 años de ruedas): holgado, para
// atrapar un costo que crezca de más (armarHistoria corre una vez por especie y otra para la ventana común). Puro.
import { describe, expect, it } from "vitest";
import { analizar } from "@/analisis/analizar";
import { crearPrng } from "@/proyecciones/prng";
import { diasHabiles, portafolio, serieDeRetornos } from "./fixtures/portafolio.ficticio";

const TOPE_MS = 5000;

describe("rendimiento del análisis", () => {
  it(`13 especies con 2.600 ruedas en menos de ${TOPE_MS} ms`, () => {
    const dias = diasHabiles("2011-01-03", 2600);
    const p = crearPrng(4613);
    const especies = Array.from({ length: 13 }, (_, k) => ({
      id: `FICTICIA-${String(k).padStart(2, "0")}`,
      cantidad: 7 + k * 37,
      cierres: serieDeRetornos(dias, 905.61 + k * 113.7, Array.from({ length: 2599 }, () => (p.uniforme() - 0.5) * 0.03)),
    }));
    const e = portafolio(especies);
    const inicio = performance.now();
    const a = analizar(e);
    const ms = performance.now() - inicio;
    expect(a.riesgo.estado).toBe("CALCULADO");
    expect(ms).toBeLessThan(TOPE_MS);
  });
});
