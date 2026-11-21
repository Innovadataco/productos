/** Quién puede escribir el plan: solo el dueño activo. La familia es de solo lectura (CONTEXTO de 008). */
import type { Prisma, PrismaClient } from "@prisma/client";
import { ErrorPlan } from "./errores";

/** Cliente o transacción: las lecturas sirven dentro y fuera de una transacción. */
export type Db = PrismaClient | Prisma.TransactionClient;

export async function exigirDueno(db: Db, autorId: string): Promise<void> {
  const usuario =
    typeof autorId === "string" && autorId.trim() !== ""
      ? await db.usuario.findUnique({ where: { id: autorId }, select: { rol: true, activo: true } })
      : null;
  if (!usuario || usuario.rol !== "DUENO" || !usuario.activo) throw new ErrorPlan("AUTOR_NO_AUTORIZADO");
}
