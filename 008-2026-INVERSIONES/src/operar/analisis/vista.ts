/**
 * El análisis del antes y el después como texto para la pantalla del simulador (sin cálculo en el cliente): las filas
 * antes/después, los escenarios a 3, 6 y 12 meses, los puntos que aparecen o desaparecen, las frases y el rótulo. Puro.
 */
import { puntoEs, pctEs, hhiEs, pesosEs, frasesAnalisis, ROTULO_ANALISIS, type DatosTexto } from "./texto";
import type { PuntoEscenario } from "./tipos";

export interface FilaAntesDespues {
  readonly titulo: string;
  readonly antes: string;
  readonly despues: string;
}

export interface VistaAnalisisSimulacion {
  readonly filas: readonly FilaAntesDespues[];
  /** Vacío si los escenarios no se calcularon. */
  readonly escenarios: readonly FilaAntesDespues[];
  readonly aparecen: readonly string[];
  readonly desaparecen: readonly string[];
  readonly frases: readonly string[];
  readonly rotulo: string;
}

const NOTA_ESCENARIOS = "Escenarios no calculados en esta simulación.";
export { NOTA_ESCENARIOS };

const rango = (p: PuntoEscenario | undefined): string => (p === undefined ? "sin dato" : `${pesosEs(p.p5)} · ${pesosEs(p.p50)} · ${pesosEs(p.p95)}`);

export function aVistaAnalisis(d: DatosTexto): VistaAnalisisSimulacion {
  const c = d.comparacion;
  const nombre = d.nombres.get(d.operadaId) ?? "la especie";
  const primera = (x: typeof c.concentracion.antes): string => (x === null ? "sin dato" : `${d.nombres.get(x.primera.instrumentoId) ?? "otra especie"} · ${pctEs(x.primera.peso)}`);
  const e = d.escenarios;
  return {
    filas: [
      { titulo: `Peso de ${nombre}`, antes: pctEs(c.pesoOperada.antes), despues: pctEs(c.pesoOperada.despues) },
      { titulo: "Primera especie", antes: primera(c.concentracion.antes), despues: primera(c.concentracion.despues) },
      { titulo: "Tres primeras especies", antes: pctEs(c.concentracion.antes?.tresPrimeras ?? null), despues: pctEs(c.concentracion.despues?.tresPrimeras ?? null) },
      { titulo: "HHI", antes: hhiEs(c.concentracion.antes?.hhi ?? null), despues: hhiEs(c.concentracion.despues?.hhi ?? null) },
      { titulo: "Volatilidad anual del portafolio", antes: pctEs(c.volatilidad.antes), despues: pctEs(c.volatilidad.despues) },
      { titulo: `Contribución de ${nombre} al riesgo`, antes: pctEs(c.contribucionOperada.antes), despues: pctEs(c.contribucionOperada.despues) },
    ],
    escenarios:
      e === null
        ? []
        : [
            ...e.antes.puntos.map((p, i) => ({ titulo: `A ${p.mes} meses (p5 · p50 · p95)`, antes: rango(p), despues: rango(e.despues.puntos[i]) })),
            { titulo: "Probabilidad de quedar por debajo de lo aportado", antes: pctEs(e.antes.probabilidadBajoAportado), despues: pctEs(e.despues.probabilidadBajoAportado) },
          ],
    aparecen: c.puntos.aparecen.map((o) => puntoEs(o, d.nombres)),
    desaparecen: c.puntos.desaparecen.map((o) => puntoEs(o, d.nombres)),
    frases: frasesAnalisis(d),
    rotulo: ROTULO_ANALISIS,
  };
}
