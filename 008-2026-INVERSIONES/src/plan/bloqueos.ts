/**
 * Bloqueos del plan, siempre dentro de una transacción (se sueltan al terminarla):
 * - Versiones: crear una versión toma el bloqueo exclusivo; registrar una decisión, el compartido.
 *   Así una versión nueva no se cuela entre leer la vigente y guardar la decisión.
 * - Decisión: un candado consultivo por decisión serializa enlazar órdenes y corregirla; quien llega
 *   segundo vuelve a leer y ve si ya fue reemplazada. Es consultivo, no `FOR UPDATE`: la web escribe como
 *   inv_app, que solo tiene INSERT en las tablas del plan (docker/migrador/privilegios.sql), y PostgreSQL
 *   exige UPDATE para bloquear filas. En READ COMMITTED cada sentencia ve lo confirmado antes de ella, así
 *   que la lectura que sigue al candado ve la corrección o el enlace de quien lo soltó.
 *   La forma de dos claves (espacio, decisión) no se cruza con los candados de una sola clave.
 */
import type { Prisma } from "@prisma/client";

const CLAVE_VERSIONES = "inv008.plan_version";
const ESPACIO_DECISION = "inv008.decision";

export async function bloquearVersiones(tx: Prisma.TransactionClient, modo: "exclusivo" | "compartido"): Promise<void> {
  if (modo === "exclusivo") await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CLAVE_VERSIONES}))`;
  else await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${CLAVE_VERSIONES}))`;
}

/** Toma el candado de la decisión y después dice si existe (falso si no). */
export async function bloquearDecision(tx: Prisma.TransactionClient, decisionId: string): Promise<boolean> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ESPACIO_DECISION}), hashtext(${decisionId}))`;
  return (await tx.decision.findUnique({ where: { id: decisionId }, select: { id: true } })) !== null;
}
