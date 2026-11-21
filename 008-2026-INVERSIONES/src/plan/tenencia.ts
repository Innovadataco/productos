/**
 * Tenencia de una especie a una fecha, por fecha de OPERACIÓN (fase B, corte 3): las compras aprobadas y los
 * lotes de escisión suman, las ventas restan, y la operación del mismo día ya cuenta. Es la regla de las
 * cantidades de `src/conciliacion/esperado.ts` (órdenes aprobadas más lotes de escisión), contada por operación
 * y no por liquidación. La usa el cálculo de los dividendos de una decisión. Puro.
 */
export interface MovimientoTenencia {
  readonly fecha: Date;
  /** Con signo: + compra o lote de escisión, − venta. */
  readonly cantidad: bigint;
}

export function tenenciaEn(movimientos: readonly MovimientoTenencia[], fecha: Date): bigint {
  return movimientos.reduce((suma, m) => (m.fecha <= fecha ? suma + m.cantidad : suma), 0n);
}

/** Fechas de los movimientos en (desde, hasta]: los únicos días en que la tenencia puede cambiar. */
const cambiosEn = (movimientos: readonly MovimientoTenencia[], desde: Date, hasta: Date): Date[] =>
  movimientos.filter((m) => m.fecha > desde && m.fecha <= hasta).map((m) => m.fecha);

/** ¿La tenencia es > 0 todos los días de [desde, hasta]? */
export function positivaEn(movimientos: readonly MovimientoTenencia[], desde: Date, hasta: Date): boolean {
  if (tenenciaEn(movimientos, desde) <= 0n) return false;
  return cambiosEn(movimientos, desde, hasta).every((f) => tenenciaEn(movimientos, f) > 0n);
}

/** ¿La tenencia es la misma todos los días de [desde, hasta]? (Una compra y una venta que se anulan el mismo día no la cambian.) */
export function constanteEn(movimientos: readonly MovimientoTenencia[], desde: Date, hasta: Date): boolean {
  const inicial = tenenciaEn(movimientos, desde);
  return cambiosEn(movimientos, desde, hasta).every((f) => tenenciaEn(movimientos, f) === inicial);
}
