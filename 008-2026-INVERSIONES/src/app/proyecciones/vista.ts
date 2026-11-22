/**
 * La vista de una proyección que viaja al navegador (frente proyecciones-pantalla): solo lo que la pantalla pinta.
 * Los puntos por mes y los indicadores en pesos enteros, los cinco controles, los textos de los supuestos y los avisos
 * con su texto. No viajan los valores ni los pesos por posición, ni trayectorias ni semilla. Puro.
 */
import type { ResultadoProyeccion } from "@/proyecciones/tipos";
import type { Controles } from "./opciones";

export interface PuntoVista {
  readonly mes: number;
  readonly p5: number;
  readonly p25: number;
  readonly p50: number;
  readonly p75: number;
  readonly p95: number;
  /** Valor de hoy más los aportes hasta ese mes. */
  readonly aportado: number;
}

export interface VistaProyeccion {
  readonly hoy: string;
  readonly valorHoy: number;
  readonly versionMetodo: string;
  readonly controles: Controles;
  readonly puntos: readonly PuntoVista[];
  /** El último mes. */
  readonly final: { readonly p5: number; readonly p50: number; readonly p95: number; readonly aportado: number };
  /** Fracción (0,1373 = 13,73 %). */
  readonly probabilidadBajoAportado: number;
  /** Fracción. */
  readonly caidaMaximaMediana: number;
  readonly textos: readonly string[];
  readonly avisos: readonly { readonly codigo: string; readonly texto: string }[];
}

const r = Math.round;

export function aVistaProyeccion(x: ResultadoProyeccion): VistaProyeccion {
  const p = x.parametros;
  const puntos = x.puntos.map((q): PuntoVista => ({ mes: q.mes, p5: r(q.p5), p25: r(q.p25), p50: r(q.p50), p75: r(q.p75), p95: r(q.p95), aportado: r(q.aportado) }));
  const fin = puntos.at(-1) ?? { p5: 0, p50: 0, p95: 0, aportado: 0 };
  return {
    hoy: x.hoy, valorHoy: r(x.valorHoy), versionMetodo: x.versionMetodo,
    controles: { horizonteMeses: p.horizonteMeses, aportePeriodico: p.aportePeriodico, frecuenciaAporte: p.frecuenciaAporte, reinvertirDividendos: p.reinvertirDividendos, caidaInicialPct: p.caidaInicialPct },
    puntos, final: { p5: fin.p5, p50: fin.p50, p95: fin.p95, aportado: fin.aportado },
    probabilidadBajoAportado: x.probabilidadBajoAportado, caidaMaximaMediana: x.caidaMaximaMediana,
    textos: [...x.supuestos.textos], avisos: x.supuestos.avisos.map((a) => ({ codigo: a.codigo, texto: a.texto })),
  };
}
