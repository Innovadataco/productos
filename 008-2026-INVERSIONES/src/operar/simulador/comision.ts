// Esqueleto del rojo: la firma, sin implementar.
import type { LadoOrden, Prisma } from "@prisma/client";
import type { ComisionEstimada, OrdenHistorica, TasaComision } from "./tipos";

export function tasaComisionHistorica(_ordenes: readonly OrdenHistorica[], _lado: LadoOrden): TasaComision {
  throw new Error("sin implementar");
}

export function estimarComision(_valorOrden: Prisma.Decimal, _tasa: TasaComision): ComisionEstimada {
  throw new Error("sin implementar");
}
