/** Reporte de lotes:construir (puro): solo conteos, códigos e ids internos; nunca cantidades, costos ni nemotécnicos. */
import type { ResultadoConstruccion } from "./construir";
import type { CodigoRechazo } from "./tipos";

const SIGNIFICADO: Readonly<Record<CodigoRechazo, string>> = {
  BLOQUEADA_VENTA_AJENA: "la orden de la bloqueada no es una venta aprobada de la especie",
  BLOQUEADA_LOTE_AJENO: "el lote de la bloqueada es de otra especie",
  BLOQUEADA_LOTE_POSTERIOR: "el lote de la bloqueada se compró después de la venta",
  BLOQUEADA_EXCEDE_VENTA: "las bloqueadas de la venta pasan su cantidad",
  BLOQUEADA_EXCEDE_LOTE: "las bloqueadas del lote pasan su cantidad",
  BLOQUEADA_EXCEDE_COSTO: "las bloqueadas del lote pasan su costo total",
  BLOQUEADA_COSTO_DESCUADRADO: "las bloqueadas agotan el lote y su costo no suma el del lote (±1 COP)",
  BLOQUEADA_INCOMPLETA: "la venta tiene una bloqueada parcial y los demás lotes no alcanzan para completarla",
  COSTO_NEGATIVO: "con las bloqueadas, el costo que le queda al lote saldría negativo",
};

export interface ReporteConstruccion {
  readonly lineas: readonly string[];
  readonly codigoSalida: 0 | 3;
}

export function reporteConstruccion(r: ResultadoConstruccion): ReporteConstruccion {
  const prefijo = r.ensayo ? "🧪 Ensayo: no se guardó nada · " : "✅ ";
  const conteos = `${prefijo}Lotes nuevos: ${r.lotesCreados} · especies con ventas: ${r.especiesConVentas} · asignaciones FIFO: ${r.asignacionesRecalculadas}`;
  const sinLotes = r.especiesSinLotes.length === 0 ? [] : [
    `⚠️  ${r.especiesSinLotes.length} especie(s) con ventas que no caben en sus lotes (VENTA_SIN_LOTES): falta registrar un lote (p. ej. de escisión). Sus ventas quedan sin asignar.`,
  ];
  const rechazadas = r.especiesRechazadas.length === 0 ? [] : [
    `⚠️  ${r.especiesRechazadas.length} especie(s) rechazada(s) por sus asignaciones bloqueadas: sus bloqueadas no se tocaron y la especie queda fuera de las posiciones. Corrija la bloqueada y vuelva a construir.`,
    ...r.especiesRechazadas.map((e) =>
      `   ${e.codigo} · especie ${e.instrumentoId}${e.ventaId ? ` · venta ${e.ventaId}` : ""}${e.loteId ? ` · lote ${e.loteId}` : ""} · ${SIGNIFICADO[e.codigo]}`),
  ];
  const lineas = [conteos, ...sinLotes, ...rechazadas];
  return { lineas, codigoSalida: sinLotes.length + rechazadas.length > 0 ? 3 : 0 };
}
