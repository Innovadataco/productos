/** Cruce de los decretos con lo que pagó Trii (fase C, C5b). Stub del rojo: las firmas; lanza PENDIENTE. */
import type { Prisma, TipoDividendo } from "@prisma/client";
import type { MovimientoTenencia } from "../../plan/tenencia";

export interface DecretoCruce {
  readonly id: string;
  readonly instrumentoId: string;
  readonly tipo: TipoDividendo;
  readonly cuota: number;
  readonly valorPorAccion: Prisma.Decimal;
  readonly fechaEx: Date;
  readonly fechaPago: Date;
}
export interface PagoTrii {
  readonly id: string;
  readonly instrumentoId: string;
  readonly fechaPago: Date;
  readonly montoNeto: Prisma.Decimal;
  readonly tipo: TipoDividendo;
}
export const ESTADOS_CRUCE = ["RECIBIDO", "PENDIENTE", "NO_RECIBIDO", "SIN_DECRETO", "REVISAR"] as const;
export type EstadoCruce = (typeof ESTADOS_CRUCE)[number];
export const MOTIVOS_REVISAR = ["TENENCIA_NEGATIVA", "PAGO_SIN_TENENCIA", "NETO_MAYOR_QUE_BRUTO", "PAGO_ANTES_DE_LA_EX", "PAGO_EN_DISPUTA", "CARGA_NO_CUBRE_LA_EX"] as const;
export type MotivoRevisar = (typeof MOTIVOS_REVISAR)[number];
export interface DecretoCruzado {
  readonly decretoId: string;
  readonly tipo: TipoDividendo;
  readonly cuota: number;
  readonly fechaEx: Date;
  readonly valorPorAccion: Prisma.Decimal;
  readonly tenenciaAntesDeLaEx: bigint;
  readonly bruto: Prisma.Decimal;
}
export interface FilaCruce {
  readonly estado: EstadoCruce;
  readonly instrumentoId: string;
  readonly fechaPago: Date;
  readonly decretos: readonly DecretoCruzado[];
  readonly pagos: readonly PagoTrii[];
  readonly brutoEsperado: Prisma.Decimal | null;
  readonly netoRecibido: Prisma.Decimal | null;
  readonly diferenciaBrutoNeto: Prisma.Decimal | null;
  readonly motivos: readonly MotivoRevisar[];
}
export interface SinTenencia {
  readonly instrumentoId: string;
  readonly fechaPago: Date;
  readonly decretoIds: readonly string[];
}
export interface ResultadoCruce {
  readonly filas: readonly FilaCruce[];
  readonly sinTenencia: readonly SinTenencia[];
}
export interface EntradaCruce {
  readonly decretos: readonly DecretoCruce[];
  readonly pagos: readonly PagoTrii[];
  readonly movimientos: ReadonlyMap<string, readonly MovimientoTenencia[]>;
  readonly cubiertoHasta: Date | null;
  readonly hoy: Date;
}
export interface Grupo {
  readonly clave: string;
  readonly instrumentoId: string;
  readonly fechaPago: Date;
  readonly decretos: readonly DecretoCruce[];
}
export interface Asignacion {
  readonly porGrupo: ReadonlyMap<string, readonly PagoTrii[]>;
  readonly enDisputa: ReadonlySet<string>;
  readonly sinGrupo: readonly PagoTrii[];
}
export interface LimitesDeLectura {
  readonly decretosDesde: Date;
  readonly pagosDesde: Date;
}

const pendiente = (): never => {
  throw new Error("PENDIENTE");
};
export const brutoDe = (_valorPorAccion: Prisma.Decimal, _tenencia: bigint): Prisma.Decimal => pendiente();
export const agruparDecretos = (_decretos: readonly DecretoCruce[]): Grupo[] => pendiente();
export const asignarPagos = (_grupos: readonly Grupo[], _pagos: readonly PagoTrii[]): Asignacion => pendiente();
export const cruzar = (_e: EntradaCruce): ResultadoCruce => pendiente();
export const limitesDeLectura = (_desde: Date): LimitesDeLectura => pendiente();
export const desdeEn = (_r: ResultadoCruce, _desde: Date): ResultadoCruce => pendiente();
