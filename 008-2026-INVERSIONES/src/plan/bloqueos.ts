/**
 * Bloqueos del plan, siempre dentro de una transacción (se sueltan al terminarla):
 * - Versiones: crear una versión toma el bloqueo exclusivo; registrar una decisión, el compartido.
 *   Así una versión nueva no se cuela entre leer la vigente y guardar la decisión.
 * - Decisión: `FOR UPDATE` sobre su fila serializa enlazar órdenes y corregirla; quien llega
 *   segundo vuelve a leer y ve si ya fue reemplazada.
 */
import type { Prisma } from "@prisma/client";

const CLAVE_VERSIONES = "inv008.plan_version";

export async function bloquearVersiones(tx: Prisma.TransactionClient, modo: "exclusivo" | "compartido"): Promise<void> {
  if (modo === "exclusivo") await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CLAVE_VERSIONES}))`;
  else await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${CLAVE_VERSIONES}))`;
}

/** Bloquea la fila de la decisión; falso si no existe. */
export async function bloquearDecision(tx: Prisma.TransactionClient, decisionId: string): Promise<boolean> {
  const filas = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "decision" WHERE "id" = ${decisionId} FOR UPDATE`;
  return filas.length > 0;
}
