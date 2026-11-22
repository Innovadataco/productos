// Esqueleto del rojo: la firma, sin implementar.
import type { Prisma } from "@prisma/client";
import type { AvisoSimulacion, ComisionEstimada, EfectoEspecie, EstadoSimulado, OperacionSimulada } from "./tipos";

export interface EfectosDeLaOrden {
  readonly especies: readonly EfectoEspecie[];
  readonly valorAccionesAntes: Prisma.Decimal;
  readonly valorAccionesDespues: Prisma.Decimal;
  readonly cajaDespues: Prisma.Decimal;
  readonly avisos: readonly AvisoSimulacion[];
}

export function calcularEfectos(_estado: EstadoSimulado, _operacion: OperacionSimulada, _valorOrden: Prisma.Decimal, _comision: ComisionEstimada): EfectosDeLaOrden {
  throw new Error("sin implementar");
}
