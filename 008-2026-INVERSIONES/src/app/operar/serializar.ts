/**
 * Del informe para operar (Decimal, bigint y Date) a la vista de /operar (texto). Puro. Las fechas son de negocio: el
 * día UTC es el día del dato (`dia` de src/app/_plan/serializar.ts). Las cifras van exactas, sin redondear: el redondeo
 * de la pantalla lo hace el formato, el mismo del tablero; el peso, con dos decimales como en el tablero.
 */
import type { CierreDia, EspecieInforme, EstadoRegla, FechaInforme, Informe, ReglaInforme, ReglasInforme } from "@/operar/informe/tipos";
import { dia } from "../_plan/serializar";
import type { CierreVista, EspecieVista, EstadoReglaVista, FechaVista, ReglaOperarVista, ReglasVista, VistaOperar } from "./tipos";

const DECIMALES_PESO = 2;
const textoDe = (v: { toString(): string } | null): string | null => (v === null ? null : v.toString());
const cierre = (c: CierreDia): CierreVista => ({ precio: c.precio.toString(), fecha: dia(c.fecha) });

const especie = (e: EspecieInforme): EspecieVista => ({
  id: e.instrumentoId,
  nemo: e.nemotecnico,
  cantidad: e.cantidad.toString(),
  cierre: e.cierre ? { ...cierre(e.cierre), verificado: e.cierre.verificado } : null,
  valor: textoDe(e.valor),
  pesoPct: e.pesoPct?.toFixed(DECIMALES_PESO) ?? null,
  sinVender: textoDe(e.sinVender),
  sinVenderPct: e.sinVenderPct?.toFixed(DECIMALES_PESO) ?? null,
  atrasado: e.cierreAtrasado,
});

function estadoRegla(e: EstadoRegla): EstadoReglaVista {
  switch (e.tipo) {
    case "TOCADA":
      return { tipo: "TOCADA", lado: e.lado, cierre: cierre(e.cierre) };
    case "EN_EL_NIVEL":
      return { tipo: "EN_EL_NIVEL", cierre: cierre(e.cierre) };
    case "A_DISTANCIA":
      return { tipo: "A_DISTANCIA", distanciaPct: e.distanciaPct.toString(), cierre: cierre(e.cierre) };
    case "SIN_CIERRE_AL_DIA":
      return { tipo: "SIN_CIERRE_AL_DIA", ultimo: e.ultimo ? cierre(e.ultimo) : null };
    default:
      return e;
  }
}

const regla = (r: ReglaInforme): ReglaOperarVista => ({
  id: r.id, especie: r.especie, condicion: r.condicion, nivel: textoDe(r.nivel), accion: r.accion, cantidad: textoDe(r.cantidad),
  plazo: r.plazoHasta ? dia(r.plazoHasta) : null, plazoVencido: r.plazoVencido, detalle: r.detalle, estado: estadoRegla(r.estado), grupo: r.grupo,
});

const reglas = (r: ReglasInforme): ReglasVista => ({
  version: r.version ? { numero: r.version.numero, desde: dia(r.version.vigenteDesde) } : null,
  seCumplen: r.seCumplen.map(regla), cercanas: r.cercanas.map(regla), resto: r.resto.map(regla),
});

function fecha(f: FechaInforme): FechaVista {
  if (f.tipo === "EX_DIVIDENDO") {
    return {
      tipo: "EX_DIVIDENDO", fecha: dia(f.fecha), id: f.id, especie: f.especie, tipoDividendo: f.tipoDividendo, cuota: f.cuota,
      valorPorAccion: f.valorPorAccion.toString(), fechaPago: dia(f.fechaPago), tenencia: f.tenencia.toString(),
    };
  }
  return { tipo: "PLAZO", fecha: dia(f.fecha), id: f.id, especie: f.especie, accion: f.accion, cantidad: textoDe(f.cantidad), condicion: f.condicion, nivel: textoDe(f.nivel) };
}

export function aVistaOperar(i: Informe): VistaOperar {
  return {
    hoy: dia(i.hoy),
    hasta: dia(i.hasta),
    referencia: i.referencia ? dia(i.referencia) : null,
    preciosAtrasados: i.preciosAtrasados,
    estado: {
      especies: i.estado.especies.map(especie),
      valorAcciones: i.estado.valorAcciones.toString(),
      sinVender: i.estado.sinVender.toString(),
      especiesSinPrecio: i.estado.especiesSinPrecio,
      especiesAtrasadas: i.estado.especiesAtrasadas,
      incompletas: [...i.estado.incompletas],
    },
    reglas: reglas(i.reglas),
    fechas: i.fechas.map(fecha),
  };
}
