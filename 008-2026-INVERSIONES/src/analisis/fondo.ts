/**
 * El fondo FIC en el análisis (fase E, A2), cambio aditivo. Puro: sin base, sin red y sin reloj.
 * - `fondosDeHistoria`: el valor de cada fondo desde la historia que ya lee `leerEntradas` (src/proyecciones/leer.ts, la
 *   misma de /proyecciones): unidades × el último valor de unidad en o antes de hoy, a dos decimales. El tablero no lee
 *   el fondo; esta es la única fuente.
 * - `portafolioConFondo`: el total (acciones más fondos) y el peso de cada parte. El fondo no entra en el riesgo, la
 *   concentración ni las especies: esas métricas siguen siendo de las acciones.
 * - `validarFondos`: el borde de la entrada; un dato fuera del contrato es un RangeError con el campo.
 */
import { Prisma } from "@prisma/client";
import { esFechaDeNegocio } from "../plan/fechas";
import { diaIso } from "../precios/horario";
import type { EntradasProyeccion, FondoEntrada } from "../proyecciones/tipos";
import { compararTexto, redondear } from "./numeros";
import type { EntradasAnalisis, FondoParaAnalisis, PortafolioConFondo } from "./tipos";

/** Pesos con centavos, como el valor del fondo en el export de la IA (src/ia/evaluacion/exportar/fondo.ts). */
const DECIMALES_PESOS = 2;

export interface FondosDeHistoria {
  readonly fondos: readonly FondoParaAnalisis[];
  /** Fondos vivos sin valor de unidad hasta hoy (o con un valor que no da pesos): no se valoran. Por id. */
  readonly sinValor: readonly string[];
}

function valorDe(f: FondoEntrada, hoy: Date): FondoParaAnalisis | null {
  const ultimo = f.valores.filter((v) => v.dia.getTime() <= hoy.getTime()).at(-1);
  if (ultimo === undefined) return null;
  const valor = new Prisma.Decimal(f.unidades).mul(ultimo.valorUnidad).toDecimalPlaces(DECIMALES_PESOS);
  return valor.isFinite() && valor.gt(0) ? { instrumentoId: f.instrumentoId, valor, dia: ultimo.dia } : null;
}

export function fondosDeHistoria(historia: EntradasProyeccion): FondosDeHistoria {
  const fondos = historia.posiciones
    .filter((p): p is FondoEntrada => p.tipo === "FONDO")
    .sort((a, b) => compararTexto(a.instrumentoId, b.instrumentoId));
  const valorados = fondos.map((f) => ({ id: f.instrumentoId, valor: valorDe(f, historia.hoy) }));
  return {
    fondos: valorados.flatMap((v) => (v.valor === null ? [] : [v.valor])),
    sinValor: valorados.flatMap((v) => (v.valor === null ? [v.id] : [])),
  };
}

export function validarFondos(fondos: readonly FondoParaAnalisis[], e: EntradasAnalisis): void {
  const especies = new Set([...e.tablero.filas, ...e.tablero.cerradas].map((f) => f.instrumentoId));
  const vistos = new Set<string>();
  for (const f of fondos) {
    if (vistos.has(f.instrumentoId)) throw new RangeError(`fondos: el id ${f.instrumentoId} viene repetido.`);
    vistos.add(f.instrumentoId);
    if (especies.has(f.instrumentoId)) throw new RangeError(`fondos: ${f.instrumentoId} es una especie del tablero.`);
    if (!(f.valor.isFinite() && f.valor.gt(0))) throw new RangeError(`fondos: el valor de ${f.instrumentoId} debe ser positivo y finito.`);
    if (!esFechaDeNegocio(f.dia)) throw new RangeError(`fondos: el día de ${f.instrumentoId} no es una fecha de negocio.`);
    if (f.dia.getTime() > e.hoy.getTime()) throw new RangeError(`fondos: el valor de ${f.instrumentoId} (${diaIso(f.dia)}) es posterior a hoy.`);
  }
}

const pesoSobre = (valor: Prisma.Decimal, total: Prisma.Decimal): number | null => (total.isZero() ? null : redondear(valor.div(total).toNumber()));

export function portafolioConFondo(fondos: readonly FondoParaAnalisis[], valorAcciones: Prisma.Decimal): PortafolioConFondo {
  const valorTotal = fondos.reduce((s, f) => s.add(f.valor), valorAcciones);
  return {
    valorTotal,
    pesoAcciones: pesoSobre(valorAcciones, valorTotal),
    fondos: fondos.map((f) => ({ instrumentoId: f.instrumentoId, valor: f.valor, dia: diaIso(f.dia), peso: pesoSobre(f.valor, valorTotal) })),
  };
}
