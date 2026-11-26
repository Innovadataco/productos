// El candado de las limpiezas: se niegan a borrar (aunque sea con inv.reversion) en una base que no termine en `_test`.
// No es una prueba (no termina en .test.ts).
import type { PrismaClient } from "@prisma/client";

export async function exigirBaseDePruebas(db: PrismaClient): Promise<void> {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a borrar en «${base}»: solo bases *_test`);
}
