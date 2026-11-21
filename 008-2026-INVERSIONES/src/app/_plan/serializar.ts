/**
 * De las lecturas del diario y de una decisión (Decimal, Date, BigInt) a sus vistas (texto). Cálculo puro.
 * Las reemplazadas no llevan resultado: sus órdenes pasaron a la corrección, que es la que se mide.
 */
import type { DecisionLeida, DetalleLeido, DiarioLeido } from "@/plan/lectura";
import type { OrdenSinDecision } from "@/plan/sin-decision";
import { MAX_RETROCESO_DIAS, type ResultadoHorizonte, type Tramo } from "@/plan/resultado";
import { sumarDias } from "@/plan/fechas";
import type { ResultadoDecision } from "@/plan/resultados-lote";
import type { ConteoVista, DecisionVista, HorizonteVista, OrdenVista, ResultadoVista, TramoVista, VistaDecision, VistaDiario } from "./tipos";

const DESFASE_COLOMBIA_MS = 5 * 60 * 60 * 1000;
/** Columnas DATE: el día UTC es el día del dato. */
export const dia = (d: Date): string => d.toISOString().slice(0, 10);
/** Instantes: el día y la hora en Colombia (UTC−5, sin horario de verano). */
export const diaColombia = (d: Date): string => dia(new Date(d.getTime() - DESFASE_COLOMBIA_MS));
export const horaColombia = (d: Date): string => new Date(d.getTime() - DESFASE_COLOMBIA_MS).toISOString().slice(0, 16).replace("T", " ");
const texto = (v: { toString(): string } | null): string | null => (v === null ? null : v.toString());

/** La ventana donde falta el cierre: la de la base si falta el precio de partida de «no actuar»; si no, la del objetivo. */
function ventanaSinPrecio(tramos: readonly Tramo[]): { desde: string; hasta: string } | null {
  const t = tramos.find((x) => x.estado === "SIN_PRECIO");
  if (!t) return null;
  const fin = t.ordenId === null && t.precioBase === null ? t.fechaBase : t.fechaObjetivo;
  return { desde: dia(sumarDias(fin, -MAX_RETROCESO_DIAS)), hasta: dia(fin) };
}

export function aResultadoVista(r: ResultadoHorizonte): ResultadoVista {
  const ventana = ventanaSinPrecio(r.tramos);
  const objetivos = r.tramos.map((t) => t.fechaObjetivo.getTime());
  return {
    estado: r.estado,
    resultadoPesos: texto(r.resultadoPesos),
    resultadoPrecio: texto(r.resultadoPrecio),
    dividendosPesos: texto(r.dividendosPesos),
    veredicto: r.veredicto,
    verificado: r.verificado,
    incluyeDividendos: r.incluyeDividendos,
    motivoSinDividendos: r.motivoSinDividendos,
    escisionEnVentana: r.escisionEnVentana,
    fechaObjetivo: objetivos.length === 0 ? null : dia(new Date(Math.max(...objetivos))),
    sinPrecioDesde: ventana?.desde ?? null,
    sinPrecioHasta: ventana?.hasta ?? null,
  };
}

export function aDecisionVista(d: DecisionLeida, r: ResultadoDecision | undefined): DecisionVista {
  const medida = d.reemplazadaPor === null && r !== undefined;
  return {
    id: d.id,
    fecha: dia(d.fechaDecision),
    especie: d.nemotecnico ?? "?",
    accion: d.accion,
    excepcion: d.excepcion,
    cantidad: texto(d.cantidad),
    regla: d.regla ? { id: d.regla.id, version: d.version.numero, condicion: d.regla.condicion, nivel: texto(d.regla.nivel), accion: d.regla.accion } : null,
    motivo: d.motivo,
    ordenes: d.ordenes,
    corrige: d.reemplaza ? { id: d.reemplaza.id, fecha: dia(d.reemplaza.fechaDecision) } : null,
    corregidaPor: d.reemplazadaPor ? { id: d.reemplazadaPor.id, fecha: dia(d.reemplazadaPor.fechaDecision) } : null,
    d30: medida ? aResultadoVista(r.d30) : null,
    d90: medida ? aResultadoVista(r.d90) : null,
  };
}

const CONTEO_VACIO: ConteoVista = { funciono: 0, noFunciono: 0, neutro: 0, sinVeredicto: 0, pendiente: 0, sinPrecio: 0, sinOrden: 0 };

function claveDe(r: ResultadoVista): keyof ConteoVista {
  if (r.estado === "PENDIENTE") return "pendiente";
  if (r.estado === "SIN_PRECIO") return "sinPrecio";
  if (r.estado === "SIN_ORDEN") return "sinOrden";
  if (r.veredicto === "FUNCIONO") return "funciono";
  if (r.veredicto === "NO_FUNCIONO") return "noFunciono";
  return r.veredicto === "NEUTRO" ? "neutro" : "sinVeredicto";
}

export const contar = (resultados: readonly ResultadoVista[]): ConteoVista =>
  resultados.reduce((c, r) => ({ ...c, [claveDe(r)]: c[claveDe(r)] + 1 }), CONTEO_VACIO);

export const aOrdenVista = (o: OrdenSinDecision): OrdenVista => ({
  id: o.id, fecha: dia(o.fechaOperacion), especie: o.nemotecnico ?? "?", lado: o.lado, cantidad: o.cantidadCompletada.toString(), filaNo: o.filaNo, cargadaEl: diaColombia(o.cargadaEn),
});

export function aVistaDiario(l: DiarioLeido, filtro: VistaDiario["filtro"], filtroInvalido: boolean): VistaDiario {
  const decisiones = l.decisiones.map((d) => aDecisionVista(d, l.resultados.get(d.id)));
  const medidas = decisiones.filter((d) => d.d30 !== null && d.d90 !== null);
  return {
    decisiones,
    truncado: l.truncado,
    resumen: { d30: contar(medidas.map((d) => d.d30!)), d90: contar(medidas.map((d) => d.d90!)) },
    inicioPlan: l.sinDecision.inicioPlan ? dia(l.sinDecision.inicioPlan) : null,
    sinDecision: l.sinDecision.sinDecision.map(aOrdenVista),
    anteriores: l.sinDecision.anterioresAlPlan.map(aOrdenVista),
    filtro,
    filtroInvalido,
  };
}

const SIGNO = { COMPRAR: 1, NO_ACTUAR: 1, VENDER: -1 } as const;

function aTramoVista(t: Tramo, signo: 1 | -1): TramoVista {
  const dv = t.dividendos;
  return {
    desde: dia(t.fechaBase),
    hasta: dia(t.fechaObjetivo),
    estado: t.estado,
    precioBase: t.precioBase ? { precio: t.precioBase.precio.toString(), fecha: dia(t.precioBase.fecha) } : null,
    precioObjetivo: t.precioObjetivo ? { precio: t.precioObjetivo.precio.toString(), fecha: dia(t.precioObjetivo.fecha) } : null,
    resultadoPrecio: texto(t.resultadoPrecio),
    dividendos: dv === null ? null : dv.medible
      ? {
          medible: true,
          total: dv.total.mul(signo).toString(),
          usados: dv.atribuidos.map((a) => ({ fechaPago: dia(a.fechaPago), montoNeto: a.montoNeto.toString(), tenencia: a.tenencia.toString(), porAccion: a.porAccion.toString(), atribuido: a.atribuido.toString() })),
        }
      : { medible: false, motivo: dv.motivo },
  };
}

export function aVistaDecision(l: DetalleLeido): VistaDecision {
  const d = l.decision;
  const horizonte = (dias: 30 | 90, r: ResultadoHorizonte): HorizonteVista => ({ dias, resultado: aResultadoVista(r), tramos: r.tramos.map((t) => aTramoVista(t, SIGNO[d.accion])) });
  return {
    decision: aDecisionVista(d, l.resultado ?? undefined),
    version: { numero: d.version.numero, desde: dia(d.version.vigenteDesde) },
    registradaEl: horaColombia(d.registradaEn),
    ordenes: l.ordenes.map((o) => ({ id: o.id, fecha: dia(o.fechaOperacion), lado: o.lado, cantidad: o.cantidadCompletada.toString(), totalEstimado: o.totalEstimado.toString(), filaNo: o.filaNo, cargadaEl: diaColombia(o.cargadaEn) })),
    enlaces: l.enlaces.map((e) => ({ id: e.id, creadoEl: diaColombia(e.creadoEn), vigente: e.vigente, motivo: e.motivo })),
    horizontes: l.resultado ? [horizonte(30, l.resultado.d30), horizonte(90, l.resultado.d90)] : null,
  };
}
