/**
 * La comparación del antes y el después con el motor de src/analisis/ (concentración, volatilidad, contribución al
 * riesgo y puntos para revisar) y el resumen de los escenarios de src/proyecciones/ (que arma escenarios.ts, con la
 * caja). Solo elige y compara: no calcula métricas propias. Puro.
 */
import type { Observacion } from "@/analisis/catalogo";
import type { Analisis } from "@/analisis/tipos";
import type { PuntoProyeccion } from "@/proyecciones/tipos";
import type { ComparacionAnalisis, ConcentracionResumida, ResumenEscenario, ValorPartida } from "./tipos";

/** Los meses de los escenarios que se muestran (horizonte de 12). */
export const MESES_ESCENARIO = [3, 6, 12] as const;

const concentracion = (a: Analisis): ConcentracionResumida | null =>
  a.concentracion === null ? null : { primera: a.concentracion.primera, tresPrimeras: a.concentracion.tresPrimeras.peso, hhi: a.concentracion.hhi };
const volatilidad = (a: Analisis): number | null => (a.riesgo.estado === "CALCULADO" ? a.riesgo.volatilidadAnual : null);
const especie = (a: Analisis, id: string) => a.especies.find((e) => e.instrumentoId === id);
const peso = (a: Analisis, id: string): number | null => especie(a, id)?.peso ?? null;
function contribucion(a: Analisis, id: string): number | null {
  const r = especie(a, id)?.riesgo;
  return r?.estado === "CUBIERTA" ? (r.contribucion?.contribucionPct ?? null) : null;
}

/** La identidad de un punto: su clave y sus ids (no sus cifras, que cambian con la operación). */
function identidad(o: Observacion): string {
  const ids = Object.entries(o.datos as Readonly<Record<string, unknown>>)
    .filter(([, v]) => typeof v === "string" || Array.isArray(v))
    .map(([k, v]) => `${k}=${String(v)}`)
    .sort();
  return [o.clave, ...ids].join("|");
}

export function diferenciaPuntos(antes: readonly Observacion[], despues: readonly Observacion[]): ComparacionAnalisis["puntos"] {
  const ya = new Set(antes.map(identidad));
  const quedan = new Set(despues.map(identidad));
  return { aparecen: despues.filter((o) => !ya.has(identidad(o))), desaparecen: antes.filter((o) => !quedan.has(identidad(o))) };
}

export interface EntradaComparacion {
  readonly antes: Analisis;
  readonly despues: Analisis;
  readonly puntosAntes: readonly Observacion[];
  readonly puntosDespues: readonly Observacion[];
  readonly instrumentoId: string;
}

export function compararAnalisis(e: EntradaComparacion): ComparacionAnalisis {
  const id = e.instrumentoId;
  return {
    concentracion: { antes: concentracion(e.antes), despues: concentracion(e.despues) },
    volatilidad: { antes: volatilidad(e.antes), despues: volatilidad(e.despues) },
    pesoOperada: { antes: peso(e.antes, id), despues: peso(e.despues, id) },
    contribucionOperada: { antes: contribucion(e.antes, id), despues: contribucion(e.despues, id) },
    puntos: diferenciaPuntos(e.puntosAntes, e.puntosDespues),
  };
}

/** Lo que se toma de una simulación del motor de proyecciones. */
export interface SimulacionResumible {
  readonly puntos: readonly PuntoProyeccion[];
  readonly probabilidadBajoAportado: number;
}

export function resumenEscenario(r: SimulacionResumible, partida: ValorPartida): ResumenEscenario {
  const puntos = MESES_ESCENARIO.flatMap((mes) => {
    const p = r.puntos.find((x) => x.mes === mes);
    return p === undefined ? [] : [{ mes, p5: p.p5, p50: p.p50, p95: p.p95 }];
  });
  return { partida, puntos, probabilidadBajoAportado: r.probabilidadBajoAportado };
}
