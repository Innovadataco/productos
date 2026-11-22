// Rendimiento del motor (encargo: 5000 trayectorias × 10 años en menos de 1 s en el Mac, en el servidor). Portafolio
// sintético de 12 acciones y un fondo, con 1500 ruedas de historia y dividendos.
// Un tope de tiempo fijo depende de la máquina: el CI corre la unidad con la cobertura v8 instrumentada y tardó 8,7 s
// donde el Mac tarda 0,4 s. Por eso, en cualquier máquina, la prueba mide cómo ESCALA: 10 veces el trabajo (5000
// contra 500 trayectorias, mismo horizonte e historia) no puede tardar más de 25 veces lo que tarda la corrida chica en
// la misma máquina y en el mismo momento. Se mide la chica antes y después de la grande y se compara con la más lenta
// de las dos, para que la carga de otros procesos no la vuelva inestable. Atrapa lo que importa (un costo que crece
// más que lineal con las trayectorias); un tope absoluto de 60 s atrapa además una caída catastrófica de rendimiento.
// Con PROYECCIONES_TOPE_MAC=1 se exige además el tope del encargo: la PRIMERA corrida del proceso (en frío, sin calentar
// el JIT, lo que ve la primera consulta) en menos de 1 s, y se imprime la medida (así se mide en el Mac para el PR).
import { describe, expect, it } from "vitest";
import { calcularProyeccion } from "@/proyecciones/calcular";
import type { AccionEntrada, EntradasProyeccion, ParametrosProyeccion } from "@/proyecciones/tipos";
import { accion, diasHabiles, entradas, fondo, serieAleatoria, valoresDiarios } from "./ficticio";

const TOPE_MAC_MS = 1000;
const TOPE_CATASTROFICO_MS = 60_000;
const TRAYECTORIAS = 5000;
const TRAYECTORIAS_CHICA = TRAYECTORIAS / 10;
const ESCALA_MAXIMA = 25;
const enMac = process.env["PROYECCIONES_TOPE_MAC"] === "1";

function portafolio(): EntradasProyeccion {
  const dias = diasHabiles("2015-01-05", 1500);
  const acciones: AccionEntrada[] = Array.from({ length: 12 }, (_, k) => {
    const cierres = serieAleatoria(dias, 811.3 + k * 371.17, 101 + k, 0.0002 + k * 0.00003, 0.012 + k * 0.001);
    const dividendos = [3, 4, 5, 6, 7].map((anio) => ({ fechaPago: dias[anio * 240 - 600 + k]!, montoNeto: 4613.27 + k * 37.9, decretadoId: null }));
    return accion(`a${k}`, 1237 + k * 113, cierres, { movimientos: [{ fecha: dias[0]!, cantidad: BigInt(1237 + k * 113) }], dividendos });
  });
  return entradas([...acciones, fondo("f", 1499.927, valoresDiarios("2014-12-01", 2200, 12_731.4419, 1.00011))]);
}

const parametros = (trayectorias: number): ParametrosProyeccion => ({
  horizonteMeses: 120, aportePeriodico: 371.53, frecuenciaAporte: "MENSUAL", reinvertirDividendos: false, caidaInicialPct: 0, trayectorias, semilla: 4613,
});

function medir(e: EntradasProyeccion, trayectorias: number): { readonly ms: number; readonly resultado: ReturnType<typeof calcularProyeccion> } {
  const inicio = performance.now();
  const resultado = calcularProyeccion(e, parametros(trayectorias));
  return { ms: performance.now() - inicio, resultado };
}

describe("rendimiento", () => {
  // Va primero: con PROYECCIONES_TOPE_MAC=1 es la primera corrida del proceso (en frío).
  it.runIf(enMac)(`en el Mac, en frío: 5000 trayectorias × 120 meses con 13 posiciones en menos de ${TOPE_MAC_MS} ms`, () => {
    const { ms, resultado } = medir(portafolio(), TRAYECTORIAS);
    process.stdout.write(`[proyecciones] en frío, 5000 × 120 meses, 13 posiciones, ${resultado.supuestos.ventana?.ruedas ?? 0} ruedas: ${ms.toFixed(0)} ms\n`);
    expect(ms).toBeLessThan(TOPE_MAC_MS);
  });

  it(`10 veces el trabajo tarda menos de ${ESCALA_MAXIMA} veces la corrida chica, en la misma máquina (y nunca ${TOPE_CATASTROFICO_MS / 1000} s)`, () => {
    const e = portafolio();
    const antes = medir(e, TRAYECTORIAS_CHICA);
    const grande = medir(e, TRAYECTORIAS);
    const despues = medir(e, TRAYECTORIAS_CHICA);
    const referencia = Math.max(antes.ms, despues.ms);
    if (enMac) process.stdout.write(`[proyecciones] chica ${antes.ms.toFixed(0)} y ${despues.ms.toFixed(0)} ms, grande ${grande.ms.toFixed(0)} ms: ${(grande.ms / referencia).toFixed(1)} veces\n`);
    expect(grande.resultado.puntos).toHaveLength(121);
    expect(grande.resultado.supuestos.posiciones.filter((p) => p.estado === "PROYECTADA")).toHaveLength(13);
    expect(grande.ms).toBeLessThan(ESCALA_MAXIMA * referencia);
    expect(grande.ms).toBeLessThan(TOPE_CATASTROFICO_MS);
  }, 180_000);
});
