/**
 * FECHA_EX (puro): avisa que se acerca (o es hoy) la fecha ex de un decreto de una especie que se tiene.
 * - Solo decretos vigentes y no anulados (el mismo criterio que `proximos.ts`) con fecha ex desde hoy.
 * - Dentro de N días hábiles (umbral, 3 por omisión) contados desde mañana hasta la ex; un ex de hoy siempre cuenta.
 * - Solo con tenencia antes de la ex (la regla de `proximos.ts`: la del cierre de ayer de la ex, o la de hoy si la ex es después).
 * - Una alerta por decreto: la clave lleva el decreto y no el día, así no se repite cada día de la ventana.
 */
import type { DecretoVigente } from "../../datos-oficiales/decretos/proximos";
import { esDiaHabil, diaIso } from "../../precios/horario";
import { sumarDias } from "../../plan/fechas";
import { tenenciaEn, type MovimientoTenencia } from "../../plan/tenencia";
import { claveDeAlerta, type Alerta } from "../tipos";
import type { Umbrales } from "../umbrales";

export type DecretoParaAlerta = Pick<DecretoVigente, "id" | "instrumentoId" | "fechaEx" | "fechaPago" | "vigente" | "anulada">;

export interface EntradaFechasEx {
  /** Día de Colombia, AAAA-MM-DD. */
  readonly dia: string;
  /** Ese día a medianoche UTC. */
  readonly hoy: Date;
  readonly decretos: readonly DecretoParaAlerta[];
  readonly movimientos: ReadonlyMap<string, readonly MovimientoTenencia[]>;
  readonly noHabiles: ReadonlySet<string>;
}

/** Días hábiles en (hoy, hasta]. */
function habilesHasta(hoy: Date, hasta: Date, noHabiles: ReadonlySet<string>, tope: number): number {
  let n = 0;
  for (let d = sumarDias(hoy, 1); d <= hasta && n <= tope; d = sumarDias(d, 1)) if (esDiaHabil(d, noHabiles)) n += 1;
  return n;
}

export function evaluarFechasEx(e: EntradaFechasEx, umbrales: Umbrales): Alerta[] {
  if (!umbrales.alertaExActiva) return [];
  const alertas: Alerta[] = [];
  for (const d of e.decretos) {
    if (!d.vigente || d.anulada || Number.isNaN(d.fechaEx.getTime()) || d.fechaEx < e.hoy) continue;
    const ayerDeLaEx = sumarDias(d.fechaEx, -1);
    const tenencia = tenenciaEn(e.movimientos.get(d.instrumentoId) ?? [], ayerDeLaEx < e.hoy ? ayerDeLaEx : e.hoy);
    if (tenencia <= 0n) continue;
    const esHoy = diaIso(d.fechaEx) === diaIso(e.hoy);
    if (!esHoy && habilesHasta(e.hoy, d.fechaEx, e.noHabiles, umbrales.alertaExDiasHabiles) > umbrales.alertaExDiasHabiles) continue;
    alertas.push({
      clave: claveDeAlerta("-", "FECHA_EX", d.instrumentoId, d.id, null), dia: e.dia, tipo: "FECHA_EX", instrumentoId: d.instrumentoId,
      reglaId: d.id, sentido: null, base: null, datos: { fechaEx: d.fechaEx, fechaPago: d.fechaPago, esFechaEx: esHoy },
    });
  }
  return alertas;
}
