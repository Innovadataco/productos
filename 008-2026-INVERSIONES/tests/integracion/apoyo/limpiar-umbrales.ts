// Limpieza de las versiones de umbrales de una prueba en la base COMPARTIDA (ver limpiar-plan.ts): solo inserción, así que el
// borrado va con `SET LOCAL inv.reversion = 'on'`. Las alertas que las citan se borran antes. No es una prueba (no termina en .test.ts).
import type { PrismaClient } from "@prisma/client";
import { exigirBaseDePruebas } from "./base-de-pruebas";

export async function limpiarUmbrales(db: PrismaClient, ids: readonly string[]): Promise<void> {
  const validos = ids.filter((i) => /^[a-z0-9-]{1,64}$/.test(i));
  if (validos.length === 0) return;
  await exigirBaseDePruebas(db);
  const lista = validos.map((i) => `'${i}'`).join(", ");
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL inv.reversion = 'on'");
    await tx.$executeRawUnsafe(`DELETE FROM alerta_vista WHERE "alertaId" IN (SELECT id FROM alerta WHERE "umbralVersionId" IN (${lista}))`);
    await tx.$executeRawUnsafe(`DELETE FROM alerta WHERE "umbralVersionId" IN (${lista})`);
    await tx.$executeRawUnsafe(`DELETE FROM umbral_version WHERE id IN (${lista})`);
  });
}
