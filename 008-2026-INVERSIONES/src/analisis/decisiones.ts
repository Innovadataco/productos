/**
 * Resumen del resultado de las decisiones a 30 y 90 días (src/plan/resultado.ts), sin volver a calcularlo. Puro.
 * - Cuenta FUNCIONO, NO_FUNCIONO y NEUTRO por horizonte, y los que no se calcularon (pendientes, sin precio, sin orden).
 * - Una calculada sin veredicto (escisión en la ventana) se cuenta aparte: su resultado en pesos está sesgado por la
 *   caída de la escisión y no entra al total.
 * - El total en pesos es por horizonte (nunca entre horizontes), en Decimal.
 */
import { Prisma } from "@prisma/client";
import type { HorizonteDias, ResultadoHorizonte, Veredicto } from "../plan/resultado";
import type { ResultadoDecision } from "../plan/resultados-lote";
import { diaIso } from "../precios/horario";
import { compararTexto } from "./numeros";
import type { MedidaDecision, ResumenDecisiones, ResumenHorizonte } from "./tipos";

/** Un horizonte con veredicto: su resultado en pesos y el día en que se conoció. */
type ConVeredicto = ResultadoHorizonte & { readonly veredicto: Veredicto; readonly resultadoPesos: Prisma.Decimal };

/** Las violaciones del contrato de resultado.ts: el motor no completa lo que falta. */
function revisar(r: ResultadoHorizonte, h: HorizonteDias, id: string): void {
  if (r.horizonteDias !== h) throw new RangeError(`La decisión ${id} trae el horizonte ${r.horizonteDias} en el lugar del de ${h} días.`);
  if (r.estado !== "CALCULADO") return;
  if (r.tramos.length === 0) throw new RangeError(`La decisión ${id} está calculada sin tramos.`);
  if (r.veredicto !== null && r.resultadoPesos === null) throw new RangeError(`La decisión ${id} tiene veredicto sin resultado en pesos.`);
}

const conVeredicto = (r: ResultadoHorizonte): r is ConVeredicto => r.estado === "CALCULADO" && r.veredicto !== null;
const conocidoEl = (r: ResultadoHorizonte): string => diaIso(new Date(Math.max(...r.tramos.map((t) => t.fechaObjetivo.getTime()))));

function resumirHorizonte(h: HorizonteDias, rs: readonly ResultadoHorizonte[]): ResumenHorizonte {
  const contados = rs.filter(conVeredicto);
  const cuenta = (v: Veredicto) => contados.filter((r) => r.veredicto === v).length;
  return {
    horizonteDias: h,
    decisiones: rs.length,
    veredictos: { FUNCIONO: cuenta("FUNCIONO"), NO_FUNCIONO: cuenta("NO_FUNCIONO"), NEUTRO: cuenta("NEUTRO") },
    sinVeredicto: rs.filter((r) => r.estado === "CALCULADO" && r.veredicto === null).length,
    pendientes: rs.filter((r) => r.estado === "PENDIENTE").length,
    sinPrecio: rs.filter((r) => r.estado === "SIN_PRECIO").length,
    sinOrden: rs.filter((r) => r.estado === "SIN_ORDEN").length,
    totalPesos: contados.reduce((s, r) => s.add(r.resultadoPesos), new Prisma.Decimal(0)),
    sinDividendosEnTotal: contados.filter((r) => !r.incluyeDividendos).length,
    noVerificadasEnTotal: contados.filter((r) => !r.verificado).length,
  };
}

const medida = (decisionId: string, r: ResultadoHorizonte): MedidaDecision[] =>
  conVeredicto(r) ? [{ decisionId, horizonteDias: r.horizonteDias, veredicto: r.veredicto, resultadoPesos: r.resultadoPesos, conocidoEl: conocidoEl(r) }] : [];

export function resumirDecisiones(decisiones: readonly ResultadoDecision[]): ResumenDecisiones {
  const ids = new Set<string>();
  for (const d of decisiones) {
    if (ids.has(d.decisionId)) throw new RangeError(`La decisión ${d.decisionId} viene repetida.`);
    ids.add(d.decisionId);
    revisar(d.d30, 30, d.decisionId);
    revisar(d.d90, 90, d.decisionId);
  }
  const medidas = decisiones
    .flatMap((d) => [...medida(d.decisionId, d.d30), ...medida(d.decisionId, d.d90)])
    .sort((a, b) => compararTexto(a.decisionId, b.decisionId) || a.horizonteDias - b.horizonteDias);
  return { d30: resumirHorizonte(30, decisiones.map((d) => d.d30)), d90: resumirHorizonte(90, decisiones.map((d) => d.d90)), medidas };
}
