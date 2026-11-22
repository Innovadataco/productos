/**
 * Dividendos por acción de una especie, para sumarlos a los retornos de la historia (los cierres no están ajustados:
 * el día del pago se suma lo cobrado y el salto ex queda compensado en el mismo bloque casi siempre). Puro.
 * - Pagos de Trii: la base guarda el neto por TODA la tenencia, sin fecha ex ni valor por acción. Por acción =
 *   neto / tenencia del día del pago (la misma regla de src/plan/dividendos.ts). Se omite (y se avisa) si ese día
 *   no había tenencia o si la tenencia cambió en los VENTANA_EX_DIAS anteriores: no se sabe qué acciones cobraron.
 * - Decretos: entran con su valor por acción (BRUTO, con aviso) solo si no tienen un pago recibido enlazado ni un pago
 *   de la especie el mismo día. Los de pago futuro solo se cuentan: la tasa histórica ya los representa.
 */
import { sumarDias } from "../plan/fechas";
import { constanteEn, tenenciaEn } from "../plan/tenencia";
import { diaIso } from "../precios/horario";
import { VENTANA_EX_DIAS } from "./metodo";
import type { AccionEntrada, AvisoCrudo, Dia } from "./tipos";

export interface PagoPorAccion {
  readonly dia: Dia;
  readonly porAccion: number;
  readonly origen: "PAGO" | "DECRETO";
}

export interface DividendosEspecie {
  /** Ordenados por día. */
  readonly pagos: readonly PagoPorAccion[];
  readonly avisos: readonly AvisoCrudo[];
  readonly decretosFuturos: number;
}

const aviso = (a: AccionEntrada, codigo: AvisoCrudo["codigo"], fecha: Date): AvisoCrudo =>
  ({ codigo, instrumentoId: a.instrumentoId, nombre: a.nombre, dia: diaIso(fecha), dato: null });

export function dividendosPorAccion(a: AccionEntrada, hoy: Date): DividendosEspecie {
  const pagos: PagoPorAccion[] = [];
  const avisos: AvisoCrudo[] = [];
  for (const d of a.dividendos) {
    const tenencia = tenenciaEn(a.movimientos, d.fechaPago);
    if (tenencia <= 0n) avisos.push(aviso(a, "DIVIDENDO_SIN_TENENCIA", d.fechaPago));
    else if (!constanteEn(a.movimientos, sumarDias(d.fechaPago, -VENTANA_EX_DIAS), d.fechaPago)) avisos.push(aviso(a, "DIVIDENDO_TENENCIA_CAMBIA", d.fechaPago));
    else pagos.push({ dia: diaIso(d.fechaPago), porAccion: d.montoNeto / Number(tenencia), origen: "PAGO" });
  }
  const diasConPago = new Set(a.dividendos.map((d) => diaIso(d.fechaPago)));
  const enlazados = new Set(a.dividendos.flatMap((d) => (d.decretadoId ? [d.decretadoId] : [])));
  let decretosFuturos = 0;
  for (const dc of a.decretos) {
    if (dc.recibido || enlazados.has(dc.id) || diasConPago.has(diaIso(dc.fechaPago))) continue;
    if (dc.fechaPago > hoy) {
      decretosFuturos += 1;
      continue;
    }
    pagos.push({ dia: diaIso(dc.fechaPago), porAccion: dc.valorPorAccion, origen: "DECRETO" });
    avisos.push(aviso(a, "DECRETO_BRUTO", dc.fechaPago));
  }
  return { pagos: pagos.sort((x, y) => (x.dia < y.dia ? -1 : x.dia > y.dia ? 1 : 0)), avisos, decretosFuturos };
}
