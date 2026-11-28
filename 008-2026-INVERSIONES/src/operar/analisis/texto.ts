/**
 * El texto del análisis del antes y el después, armado por el CÓDIGO con una plantilla determinista (sin IA en el
 * servidor): de 3 a 5 frases con las cifras del motor. Dice efectos y cita el plan del dueño; nunca juzga la operación
 * ni aconseja (candado de lenguaje en tests/unit/operar/analisis/). Puro.
 */
import { Prisma } from "@prisma/client";
import type { Observacion } from "@/analisis/catalogo";
import type { LadoSimulado } from "../simulador/tipos";
import { textoPesosRedondos } from "../simulador/textos";
import { nivelEs } from "@/plan/edicion/formato";
import { DECIMALES_PESO } from "./decimales";
import type { AntesDespues, ComparacionAnalisis, FuenteCaja, ResumenEscenario } from "./tipos";

export const ROTULO_ANALISIS = "Análisis calculado por Inversiones · la IA lo redactará cuando el servicio de IA esté conectado";

const SIN_DATO = "sin dato";
const OTRA = "otra especie";
const DECIMALES_PCT = DECIMALES_PESO;
const DECIMALES_HHI = 3;
const LADO: Readonly<Record<LadoSimulado, string>> = { COMPRAR: "compra", VENDER: "venta" };

/** «12.30» → «12,30»: miles con punto y la coma decimal, CONSERVANDO los ceros de la derecha (a diferencia de `nivelEs`). */
export function porcentajeEs(fijo: string): string {
  const [entero = "0", fraccion] = fijo.split(".");
  return fraccion === undefined ? nivelEs(entero) : `${nivelEs(entero)},${fraccion}`;
}
const decimal = (x: number, decimales: number): string => porcentajeEs(new Prisma.Decimal(x).toDecimalPlaces(decimales, Prisma.Decimal.ROUND_HALF_UP).toFixed(decimales));
/** Una fracción como porcentaje con 2 decimales: 0,2113 → «21,13 %». */
export const pctEs = (x: number | null): string => (x === null ? SIN_DATO : `${decimal(x * 100, DECIMALES_PCT)} %`);
export const hhiEs = (x: number | null): string => (x === null ? SIN_DATO : decimal(x, DECIMALES_HHI));
/** Pesos de la proyección, sin decimales. */
export const pesosEs = (x: number): string => textoPesosRedondos(new Prisma.Decimal(x));

const MAS = "+";
const MENOS = "−";
/** La variación del después frente al antes, en %: «+0,59 %», «−5,79 %», «0 %»; sin dato si el antes no es positivo. */
export function variacionEs(antes: number, despues: number): string {
  if (!(antes > 0)) return SIN_DATO;
  const pct = new Prisma.Decimal(despues).sub(antes).div(antes).mul(100).toDecimalPlaces(DECIMALES_PCT, Prisma.Decimal.ROUND_HALF_UP);
  const signo = pct.isZero() ? "" : pct.isNeg() ? MENOS : MAS;
  return `${signo}${porcentajeEs(pct.abs().toFixed(DECIMALES_PCT))} %`;
}

const CAJA_ANTES: Readonly<Record<FuenteCaja, string>> = {
  ESCRITA: "el saldo que usted escribió",
  AV: "la certificada por Acciones & Valores",
  SIN_CERTIFICACION: "0 (no hay certificación de Acciones & Valores)",
};
const CAJA_DESPUES: Readonly<Record<LadoSimulado, string>> = {
  COMPRAR: "esa caja menos el valor de la orden y la comisión",
  VENDER: "esa caja más el valor de la orden y menos la comisión",
};
/** El rótulo de la caja de los escenarios: de dónde sale la de antes y qué se le resta o se le suma después. */
export const notaCaja = (caja: FuenteCaja, lado: LadoSimulado): string =>
  `La caja entra en los escenarios como parte fija, sin rendimiento: antes, ${CAJA_ANTES[caja]}; después, ${CAJA_DESPUES[lado]}.`;

export interface DatosTexto {
  readonly comparacion: ComparacionAnalisis;
  readonly escenarios: AntesDespues<ResumenEscenario> | null;
  readonly nombres: ReadonlyMap<string, string>;
  readonly operadaId: string;
  readonly lado: LadoSimulado;
  /** Lo que dice el plan del dueño para la especie (el texto de su regla), o null si no hay regla que la toque. */
  readonly plan: string | null;
  /** De dónde sale la caja de antes (se rotula). */
  readonly caja: FuenteCaja;
}

function concentracionFrase(d: DatosTexto, nombre: string): string {
  const { pesoOperada: p, concentracion: c } = d.comparacion;
  const inicio = `Con esta ${LADO[d.lado]}, ${nombre} pasa de ${pctEs(p.antes)} a ${pctEs(p.despues)} del valor de las acciones`;
  if (c.antes === null || c.despues === null) return `${inicio}; la concentración no se calcula: no hay especies con valor.`;
  return `${inicio}; las tres primeras especies pasan de ${pctEs(c.antes.tresPrimeras)} a ${pctEs(c.despues.tresPrimeras)} y el HHI, de ${hhiEs(c.antes.hhi)} a ${hhiEs(c.despues.hhi)}.`;
}

function riesgoFrase(c: ComparacionAnalisis, nombre: string): string {
  const { volatilidad: v, contribucionOperada: r } = c;
  if (v.antes === null || v.despues === null) return "La volatilidad del portafolio no se calcula: falta historia de precios.";
  const inicio = `La volatilidad anual del portafolio pasa de ${pctEs(v.antes)} a ${pctEs(v.despues)}`;
  if (r.antes === null || r.despues === null) return `${inicio}; la contribución de ${nombre} al riesgo no se calcula con su historia.`;
  return `${inicio} y la contribución de ${nombre} al riesgo, de ${pctEs(r.antes)} a ${pctEs(r.despues)}.`;
}

function escenarioFrase(e: DatosTexto["escenarios"]): string {
  const antes = e?.antes.puntos.at(-1);
  const despues = e?.despues.puntos.at(-1);
  if (e === null || antes === undefined || despues === undefined) return "Los escenarios no se calcularon en esta simulación.";
  const partida = pesosEs(e.antes.partida.total);
  return (
    `Contando la caja como parte fija, sin rendimiento, el portafolio parte de ${partida} antes y de ${pesosEs(e.despues.partida.total)} después; ` +
    `en el escenario central a ${despues.mes} meses (mediana) pasa de ${pesosEs(antes.p50)} a ${pesosEs(despues.p50)} (${variacionEs(antes.p50, despues.p50)}) ` +
    `y la probabilidad de quedar por debajo de lo aportado (${partida}, que la operación no cambia), de ${pctEs(e.antes.probabilidadBajoAportado)} a ${pctEs(e.despues.probabilidadBajoAportado)}.`
  );
}

/** El punto para revisar en palabras, con los nombres de las especies. */
export function puntoEs(o: Observacion, nombres: ReadonlyMap<string, string>): string {
  const n = (id: string | null): string => (id === null ? "el portafolio" : (nombres.get(id) ?? OTRA));
  switch (o.clave) {
    case "CONCENTRACION_ALTA":
      return `concentración alta en ${n(o.datos.instrumentoId)}`;
    case "CONCENTRACION_TOP_TRES":
      return `concentración alta en las tres primeras (${o.datos.instrumentoIds.map(n).join(", ")})`;
    case "CORRELACION_ALTA":
      return `correlación alta entre ${n(o.datos.instrumentoIds[0])} y ${n(o.datos.instrumentoIds[1])}`;
    case "CONTRIBUCION_RIESGO_DESPROPORCIONADA":
      return `contribución al riesgo mayor que su peso en ${n(o.datos.instrumentoId)}`;
    default:
      return o.clave.toLowerCase().replace(/_/g, " ");
  }
}

function puntosFrase(d: DatosTexto): string {
  const { aparecen, desaparecen } = d.comparacion.puntos;
  if (aparecen.length === 0 && desaparecen.length === 0) return "Los puntos para revisar no cambian.";
  const lista = (os: readonly Observacion[]) => os.map((o) => puntoEs(o, d.nombres)).join("; ");
  const partes = [
    ...(aparecen.length === 0 ? [] : [`${aparecen.length === 1 ? "Aparece 1 punto" : `Aparecen ${aparecen.length} puntos`} para revisar: ${lista(aparecen)}`]),
    ...(desaparecen.length === 0 ? [] : [`${desaparecen.length === 1 ? "Desaparece 1 punto" : `Desaparecen ${desaparecen.length} puntos`} para revisar: ${lista(desaparecen)}`]),
  ];
  return `${partes.join(". ")}.`;
}

/** De 3 a 5 frases: concentración, riesgo, escenarios, puntos para revisar y, si lo hay, lo que dice su plan. */
export function frasesAnalisis(d: DatosTexto): string[] {
  const nombre = d.nombres.get(d.operadaId) ?? OTRA;
  return [
    concentracionFrase(d, nombre),
    riesgoFrase(d.comparacion, nombre),
    escenarioFrase(d.escenarios),
    puntosFrase(d),
    ...(d.plan === null ? [] : [`Su plan para esta especie: ${d.plan}`]),
  ];
}
