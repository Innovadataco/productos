/**
 * Aritmética exacta para las alertas. `Prisma.Decimal` redondea a 20 dígitos significativos: una tenencia grande por un precio
 * de 4 decimales ya se pasa. Esta clase usa 80, suficiente para bigint × Decimal sin pérdida en cualquier cuenta de 008.
 */
import { Prisma } from "@prisma/client";

export const Exacto = Prisma.Decimal.clone({ precision: 80 });
export type Exacto = InstanceType<typeof Exacto>;

const CIEN = new Exacto(100);
const DECIMALES_PCT = 2;

export const aExacto = (v: Prisma.Decimal | bigint | string): Exacto => new Exacto(typeof v === "bigint" ? v.toString() : v.toString());

/** (actual − anterior) / anterior × 100, recortado a 2 decimales (solo para mostrar; las comparaciones no lo usan). */
export const variacionPct = (actual: Exacto, anterior: Exacto): Prisma.Decimal =>
  new Prisma.Decimal(actual.sub(anterior).div(anterior).mul(CIEN).toDecimalPlaces(DECIMALES_PCT, Exacto.ROUND_HALF_UP).toString());

/** |actual − anterior| × 100 ≥ umbral × anterior, sin dividir (anterior > 0). Inclusivo. */
export const variaAlMenos = (actual: Exacto, anterior: Exacto, umbralPct: number): boolean =>
  actual.sub(anterior).abs().mul(CIEN).gte(new Exacto(umbralPct.toString()).mul(anterior));
