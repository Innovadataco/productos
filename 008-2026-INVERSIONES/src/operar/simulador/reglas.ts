// Esqueleto del rojo: la firma, sin implementar.
import type { Prisma } from "@prisma/client";
import type { OperacionSimulada, ReglaAfectada, ReglaSimulada } from "./tipos";

export function rigeHoy(_regla: ReglaSimulada, _hoy: Date): boolean {
  throw new Error("sin implementar");
}

export function reglasAfectadas(_reglas: readonly ReglaSimulada[], _operacion: OperacionSimulada, _valorOrden: Prisma.Decimal, _hoy: Date): ReglaAfectada[] {
  throw new Error("sin implementar");
}
