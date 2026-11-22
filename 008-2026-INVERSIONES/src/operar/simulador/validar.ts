// Esqueleto del rojo: la firma, sin implementar.
import { Prisma } from "@prisma/client";
import type { ContextoSimulacion, ErrorSimulacion, EstadoSimulado, OperacionSimulada, PosicionSimulada } from "./tipos";

export const TOPE_MONTO = new Prisma.Decimal("10000000000000");

export type RevisionOperacion =
  | { readonly ok: true; readonly posicion: PosicionSimulada; readonly valorOrden: Prisma.Decimal }
  | { readonly ok: false; readonly errores: readonly [ErrorSimulacion, ...ErrorSimulacion[]] };

export function validarEstado(_estado: EstadoSimulado): void {
  throw new Error("sin implementar");
}

export function validarContexto(_contexto: ContextoSimulacion): void {
  throw new Error("sin implementar");
}

export function revisarOperacion(_operacion: OperacionSimulada, _posiciones: readonly PosicionSimulada[]): RevisionOperacion {
  throw new Error("sin implementar");
}
