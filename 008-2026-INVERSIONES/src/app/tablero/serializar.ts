import type { Resumen } from "@/tablero/datos";
import type { FilaTablero } from "@/tablero/calculo";
import type { FilaVista, Vista } from "./tipos";

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
    cierre: f.cierre ? { precio: f.cierre.precio.toString(), fecha: dia(f.cierre.fecha), verificado: f.cierre.verificado } : null,
    lotesVivos: f.lotesVivos, serie: f.serie.map((p) => ({ fecha: dia(p.fecha), precio: p.precio.toString() })),
  };
}

export function aVista(r: Resumen): Vista {
  const t = r.tablero;
  return {
    filas: t.filas.map(fila), cerradas: t.cerradas.map(fila),
    valorAcciones: t.valorAcciones.toString(), sinVender: t.sinVender.toString(), porVentas: t.porVentas.toString(),
    dividendos: t.dividendos.toString(), comisiones: t.comisiones.toString(), gananciaTotal: t.gananciaTotal.toString(),
    especiesSinPrecio: t.especiesSinPrecio,
    ultimoCierre: r.ultimoCierre ? dia(r.ultimoCierre) : null, ultimaCarga: r.ultimaCarga ? diaColombia(r.ultimaCarga) : null,
    incompletas: r.incompletas,
  };
}
