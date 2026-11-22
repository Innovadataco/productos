/** Próximos ex-dividendos (fase C, C5b). Stub del rojo: las firmas; lanza PENDIENTE. */
import type { Prisma, TipoDividendo } from "@prisma/client";
import type { MovimientoTenencia } from "../../plan/tenencia";

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
  readonly vigente: boolean;
  readonly anulada: boolean;
}
export interface Proximo extends Omit<DecretoVigente, "vigente" | "anulada"> {
  readonly tenencia: bigint;
  readonly brutoEstimado: Prisma.Decimal | null;
}

export function proximos(_decretos: readonly DecretoVigente[], _movimientos: ReadonlyMap<string, readonly MovimientoTenencia[]>, _hoy: Date): Proximo[] {
  throw new Error("PENDIENTE");
}
