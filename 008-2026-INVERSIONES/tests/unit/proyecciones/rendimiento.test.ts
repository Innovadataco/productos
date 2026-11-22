// Rendimiento del motor (encargo: 5000 trayectorias × 10 años en menos de 1 s en el Mac, en el servidor). Portafolio
// sintético de 12 acciones y un fondo, con 1500 ruedas de historia y dividendos. Se mide la PRIMERA corrida del
// proceso (en frío, sin calentar el JIT), que es lo que ve la primera consulta.
// Tope holgado por defecto (5 s): aguanta el CI y la instrumentación de la cobertura v8. Con PROYECCIONES_TOPE_MAC=1
// se exige el tope del encargo (1 s) y se imprime la medida (así se midió en el Mac para el PR).
import { describe, expect, it } from "vitest";
import { calcularProyeccion } from "@/proyecciones/calcular";
import type { AccionEntrada } from "@/proyecciones/tipos";
import { accion, diasHabiles, entradas, fondo, serieAleatoria, valoresDiarios } from "./ficticio";

const TOPE_HOLGADO_MS = 5000;
const TOPE_MAC_MS = 1000;
const enMac = process.env["PROYECCIONES_TOPE_MAC"] === "1";

function portafolio() {
  const dias = diasHabiles("2015-01-05", 1500);
  const acciones: AccionEntrada[] = Array.from({ length: 12 }, (_, k) => {
    const cierres = serieAleatoria(dias, 811.3 + k * 371.17, 101 + k, 0.0002 + k * 0.00003, 0.012 + k * 0.001);
    const dividendos = [3, 4, 5, 6, 7].map((anio) => ({ fechaPago: dias[anio * 240 - 600 + k]!, montoNeto: 4613.27 + k * 37.9, decretadoId: null }));
    return accion(`a${k}`, 1237 + k * 113, cierres, { movimientos: [{ fecha: dias[0]!, cantidad: BigInt(1237 + k * 113) }], dividendos });
  });
  return entradas([...acciones, fondo("f", 1499.927, valoresDiarios("2014-12-01", 2200, 12_731.4419, 1.00011))]);
}

describe("rendimiento", () => {
  it(`5000 trayectorias × 120 meses con 13 posiciones: menos de ${enMac ? TOPE_MAC_MS : TOPE_HOLGADO_MS} ms`, () => {
    const e = portafolio();
    const inicio = performance.now();
    const r = calcularProyeccion(e, {
      horizonteMeses: 120, aportePeriodico: 371.53, frecuenciaAporte: "MENSUAL", reinvertirDividendos: false, caidaInicialPct: 0, trayectorias: 5000, semilla: 4613,
    });
    const ms = performance.now() - inicio;
    if (enMac) process.stdout.write(`[proyecciones] 5000 × 120 meses, 13 posiciones, ${r.supuestos.ventana?.ruedas ?? 0} ruedas: ${ms.toFixed(0)} ms\n`);
    expect(r.puntos).toHaveLength(121);
    expect(r.supuestos.posiciones.filter((p) => p.estado === "PROYECTADA")).toHaveLength(13);
    expect(ms).toBeLessThan(enMac ? TOPE_MAC_MS : TOPE_HOLGADO_MS);
  }, 30_000);
});
