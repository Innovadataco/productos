// Resultados INVENTADOS para las pruebas de la pantalla de proyecciones (frente proyecciones-pantalla). No es una
// prueba. Nada sale de una base: puntos sintéticos con números raros y fechas de 2027 o anteriores a 2022.
import { AVISO, type ParametrosProyeccion, type PuntoProyeccion, type ResultadoProyeccion, type Supuestos } from "@/proyecciones/tipos";

export const PARAMETROS: ParametrosProyeccion = {
  horizonteMeses: 12, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0, trayectorias: 2000, semilla: 46133,
};

/** Puntos con un abanico que se abre: la mediana sube `paso` por mes y las bandas se separan `abre` por mes. */
export function puntosFicticios(horizonte: number, inicio = 46137.41, paso = 211.37, abre = 97.13, aporte = 0): PuntoProyeccion[] {
  return Array.from({ length: horizonte + 1 }, (_, m) => {
    const p50 = inicio + paso * m + aporte * m;
    return {
      mes: m, p5: p50 - 2 * abre * m, p25: p50 - abre * m, p50, p75: p50 + abre * m, p95: p50 + 2.3 * abre * m,
      aportado: inicio + aporte * m, dividendosP50: 3.17 * m,
    };
  });
}

const SUPUESTOS: Supuestos = {
  ventana: { desde: "2019-01-02", hasta: "2021-12-30", ruedas: 757, limitadaPor: "FICTA" },
  ruedasPorMes: 21.03, bloque: 20, minimoDias: 250, fraccionProyectada: 0.913, rendimientoAnualVentana: 0.0417, volatilidadAnualVentana: 0.1937, decretosFuturos: 0,
  posiciones: [
    { instrumentoId: "i-a", nombre: "FICTA", tipo: "ACCION", estado: "PROYECTADA", valorHoy: 31_337.17, peso: 0.6791, diasEnVentana: 757, diasTotales: 760, ultimoDia: "2021-12-30", dividendosUsados: 2, primerDividendo: "2020-07-15" },
  ],
  avisos: [{ codigo: "HISTORIA_CORTA", instrumentoId: "i-c", nombre: "FICTC", dia: null, dato: 43, texto: "FICTC: 43 días con cierre, menos de 250: queda fija en su valor de hoy, sin retorno, volatilidad ni dividendos." }],
  textos: [
    "Método: remuestreo de la historia (bootstrap circular) en bloques de 20 ruedas consecutivas.",
    "Ventana histórica: del 2019-01-02 al 2021-12-30, 757 ruedas de la BVC.",
  ],
};

export function resultadoFicticio(o: Partial<ResultadoProyeccion> = {}): ResultadoProyeccion {
  const parametros = o.parametros ?? PARAMETROS;
  return {
    aviso: AVISO, versionMetodo: "bootstrap-circular-v1", parametros, hoy: "2027-03-17", valorHoy: 46137.41,
    puntos: puntosFicticios(parametros.horizonteMeses), probabilidadBajoAportado: 0.1373, caidaMaximaMediana: 0.0917, supuestos: SUPUESTOS, ...o,
  };
}
