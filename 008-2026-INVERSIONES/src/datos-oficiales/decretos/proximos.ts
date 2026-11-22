/**
 * Próximos ex-dividendos (fase C, C5b). Puro. Los decretos VIGENTES (sin reemplazo), no anulados y con fecha ex mayor o
 * igual a hoy, por fecha ex, especie, cuota, tipo (el ordinario primero) e id. Lo lee leer.ts; lo muestra C6b.
 * Cada uno con la tenencia de su especie (src/plan/tenencia.ts, por operación) y el bruto ESTIMADO = valor por acción ×
 * esa tenencia (exacto, cruce.ts): si la ex es hoy, la tenencia ya quedó fija al cierre de ayer; si es después, es la de
 * hoy y puede cambiar antes de la ex. La regla ex está por verificar (P12). Con una tenencia negativa (faltan compras
 * cargadas) no se estima nada: null.
 * Informa; no recomienda comprar ni vender.
 */
import type { Prisma, TipoDividendo } from "@prisma/client";
import { sumarDias } from "../../plan/fechas";
import { tenenciaEn, type MovimientoTenencia } from "../../plan/tenencia";
import { brutoDe, compararTexto, ordenTipo } from "./cruce";

export interface DecretoVigente {
  readonly id: string;
  readonly instrumentoId: string;
  readonly nemotecnico: string | null;
  readonly tipo: TipoDividendo;
  readonly cuota: number;
  readonly valorPorAccion: Prisma.Decimal;
  readonly fechaAnuncio: Date;
  readonly fechaEx: Date;
  readonly fechaPago: Date;
  readonly referenciaOficial: string;
  readonly version: number;
  /** reemplazadoEn nulo. */
  readonly vigente: boolean;
  readonly anulada: boolean;
}

export interface Proximo extends Omit<DecretoVigente, "vigente" | "anulada"> {
  readonly tenencia: bigint;
  /** valor × tenencia; null si la tenencia es negativa. ESTIMADO. */
  readonly brutoEstimado: Prisma.Decimal | null;
}

const porProximo = (a: Proximo, b: Proximo): number =>
  a.fechaEx.getTime() - b.fechaEx.getTime() || compararTexto(a.nemotecnico ?? a.instrumentoId, b.nemotecnico ?? b.instrumentoId) ||
  a.cuota - b.cuota || ordenTipo(a.tipo, b.tipo) || compararTexto(a.id, b.id);

export function proximos(decretos: readonly DecretoVigente[], movimientos: ReadonlyMap<string, readonly MovimientoTenencia[]>, hoy: Date): Proximo[] {
  return decretos
    .filter((d) => d.vigente && !d.anulada && d.fechaEx >= hoy)
    .map(({ vigente: _v, anulada: _a, ...d }): Proximo => {
      const ayerDeLaEx = sumarDias(d.fechaEx, -1);
      const tenencia = tenenciaEn(movimientos.get(d.instrumentoId) ?? [], ayerDeLaEx < hoy ? ayerDeLaEx : hoy);
      return { ...d, tenencia, brutoEstimado: tenencia < 0n ? null : brutoDe(d.valorPorAccion, tenencia) };
    })
    .sort(porProximo);
}
