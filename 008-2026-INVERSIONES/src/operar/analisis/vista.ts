/**
 * El análisis del antes y el después como texto para la pantalla del simulador (sin cálculo en el cliente): las filas
 * antes/después, el valor de partida (acciones, fondo y caja), los escenarios a 3, 6 y 12 meses con su variación, los puntos que aparecen o desaparecen, las frases y el rótulo. Puro.
 */
import { puntoEs, pctEs, hhiEs, pesosEs, frasesAnalisis, notaCaja, variacionEs, ROTULO_ANALISIS, type DatosTexto } from "./texto";
import type { AntesDespues, PuntoEscenario, ResumenEscenario } from "./tipos";

export interface FilaAntesDespues {
  readonly titulo: string;
  readonly antes: string;
  readonly despues: string;
  /** La variación del después frente al antes, en % (en los percentiles de los escenarios). */
  readonly variacion?: string;
}

export interface VistaAnalisisSimulacion {
  readonly filas: readonly FilaAntesDespues[];
  /** El valor de partida de los escenarios: acciones, fondo (si entra), caja y total. Vacío sin escenarios. */
  readonly partida: readonly FilaAntesDespues[];
  /** De dónde sale la caja de los escenarios y qué se le resta o se le suma. */
  readonly notaCaja: string;
  /** Vacío si los escenarios no se calcularon. */
  readonly escenarios: readonly FilaAntesDespues[];
  readonly aparecen: readonly string[];
  readonly desaparecen: readonly string[];
  readonly frases: readonly string[];
  readonly rotulo: string;
}

const NOTA_ESCENARIOS = "Escenarios no calculados en esta simulación.";
export { NOTA_ESCENARIOS };

const PERCENTILES = ["p5", "p50", "p95"] as const;
const rango = (p: PuntoEscenario | undefined): string => (p === undefined ? "sin dato" : PERCENTILES.map((q) => pesosEs(p[q])).join(" · "));

function filaEscenario(antes: PuntoEscenario, despues: PuntoEscenario | undefined): FilaAntesDespues {
  const fila = { titulo: `A ${antes.mes} meses (p5 · p50 · p95)`, antes: rango(antes), despues: rango(despues) };
  return despues === undefined ? fila : { ...fila, variacion: PERCENTILES.map((q) => variacionEs(antes[q], despues[q])).join(" · ") };
}

function filasPartida(e: AntesDespues<ResumenEscenario>): FilaAntesDespues[] {
  const a = e.antes.partida;
  const d = e.despues.partida;
  const fila = (titulo: string, antes: number, despues: number): FilaAntesDespues => ({ titulo, antes: pesosEs(antes), despues: pesosEs(despues) });
  return [
    fila("Acciones", a.acciones, d.acciones),
    ...(a.fondo === null && d.fondo === null ? [] : [fila("Fondo", a.fondo ?? 0, d.fondo ?? 0)]),
    fila("Caja (parte fija, sin rendimiento)", a.caja, d.caja),
    fila("Valor de partida", a.total, d.total),
  ];
}

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
    partida: e === null ? [] : filasPartida(e),
    notaCaja: notaCaja(d.caja, d.lado),
    escenarios:
      e === null
        ? []
        : [
            ...e.antes.puntos.map((p, i) => filaEscenario(p, e.despues.puntos[i])),
            { titulo: "Probabilidad de quedar por debajo de lo aportado", antes: pctEs(e.antes.probabilidadBajoAportado), despues: pctEs(e.despues.probabilidadBajoAportado) },
          ],
    aparecen: c.puntos.aparecen.map((o) => puntoEs(o, d.nombres)),
    desaparecen: c.puntos.desaparecen.map((o) => puntoEs(o, d.nombres)),
    frases: frasesAnalisis(d),
    rotulo: ROTULO_ANALISIS,
  };
}
