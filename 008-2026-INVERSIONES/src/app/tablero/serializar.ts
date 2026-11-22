import { horaColombia } from "@/app/_comun/fecha-dato/hora";
import type { Resumen } from "@/tablero/datos";
import type { FilaTablero } from "@/tablero/calculo";
import { componer, type Tajada } from "@/tablero/composicion";
import type { Evolucion } from "@/tablero/evolucion";
import type { Movimiento } from "@/tablero/movimiento";
import type { EvolucionVista, FilaVista, MovimientoVista, TajadaVista, Vista } from "./tipos";

// Columnas DATE (cierres): el día UTC es el día del dato.
const dia = (d: Date) => d.toISOString().slice(0, 10);
// Instantes (última carga): el día en Colombia (UTC−5, sin horario de verano).
const DESFASE_COLOMBIA_MS = 5 * 60 * 60 * 1000;
const diaColombia = (d: Date) => dia(new Date(d.getTime() - DESFASE_COLOMBIA_MS));

function fila(f: FilaTablero): FilaVista {
  return {
    id: f.instrumentoId, nemo: f.nemotecnico, cantidad: f.cantidad.toString(), costo: f.costoVivo.toString(),
    valor: f.valor?.toString() ?? null, sinVender: f.sinVender?.toString() ?? null,
    rentabilidadPct: f.rentabilidadPct?.toFixed(2) ?? null, pesoPct: f.pesoPct?.toFixed(2) ?? null,
    realizada: f.realizada.toString(), dividendos: f.dividendos.toString(), comisiones: f.comisiones.toString(),
    cierre: f.cierre ? {
      precio: f.cierre.precio.toString(), fecha: dia(f.cierre.fecha), verificado: f.cierre.verificado, atrasado: f.cierreAtrasado,
      traidoEn: f.cierre.traidoEn ? horaColombia(f.cierre.traidoEn) : null, fuente: f.cierre.fuente ?? null,
    } : null,
    lotesVivos: f.lotesVivos, serie: f.serie.map((p) => ({ fecha: dia(p.fecha), precio: p.precio.toString() })),
  };
}

function movimiento(m: Movimiento): MovimientoVista {
  return {
    referencia: m.referencia ? dia(m.referencia) : null, previa: m.previa ? dia(m.previa) : null,
    especies: m.especies.map((e) => ({ id: e.instrumentoId, nemo: e.nemotecnico, aporte: e.aporte.toString(), variacionPct: e.variacionPct.toFixed(2) })),
    neto: m.neto?.toString() ?? null, omitidas: m.omitidas, motivo: m.motivo,
  };
}

const tajada = (t: Tajada): TajadaVista => ({ id: t.id, nemo: t.nemo, valor: t.valor.toString(), pesoPct: t.pesoPct.toFixed(2), miembros: t.miembros });

/** La evolución en texto: valor y costo exactos; TWR en porcentaje (4 decimales por día, 2 por rango). */
export function aEvolucionVista(e: Evolucion): EvolucionVista {
  return {
    metodo: e.metodo,
    puntos: e.puntos.map((p) => ({ fecha: dia(p.fecha), valor: p.valor.toString(), costo: p.costo.toString(), twrPct: p.twr.mul(100).toFixed(4), atrasadas: p.atrasadas })),
    rangos: e.rangos.map((r) => ({ clave: r.clave, desde: dia(r.desde), inicio: r.inicio, cubre: r.cubre, twrPct: r.twr === null ? null : r.twr.mul(100).toFixed(2) })),
    omitidos: e.omitidos,
    sinCierre: e.sinCierre,
  };
}

export function aVista(r: Resumen): Vista {
  const t = r.tablero;
  return {
    filas: t.filas.map(fila), cerradas: t.cerradas.map(fila),
    valorAcciones: t.valorAcciones.toString(), sinVender: t.sinVender.toString(), porVentas: t.porVentas.toString(),
    dividendos: t.dividendos.toString(), comisiones: t.comisiones.toString(), gananciaTotal: t.gananciaTotal.toString(),
    especiesSinPrecio: t.especiesSinPrecio,
    fechaReferencia: t.fechaReferencia ? dia(t.fechaReferencia) : null, cierreMasViejo: t.cierreMasViejo ? dia(t.cierreMasViejo) : null,
    especiesAtrasadas: t.especiesAtrasadas, movimiento: movimiento(r.movimiento),
    ultimaCarga: r.ultimaCarga ? diaColombia(r.ultimaCarga) : null,
    incompletas: r.incompletas,
    composicion: componer(t.filas).map(tajada),
  };
}
