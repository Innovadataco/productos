// Limpieza de un plan de prueba en la base COMPARTIDA de las pruebas de integración: la vigencia de una versión del plan no
// retrocede y la versión vigente es la de mayor número, así que un plan sembrado por una prueba (con un número alto o una
// vigencia lejana) rompería a las que corren después (la edición del plan, las páginas del plan, el informe). Las tablas son de
// solo inserción: el borrado va en una transacción con `SET LOCAL inv.reversion = 'on'`, el procedimiento de corrección del
// dueño (la función inv_solo_insercion lo admite). Borra, en orden de las llaves: las marcas de vista y las alertas que citan
// sus reglas, sus reglas y sus versiones. No es una prueba (no termina en .test.ts).
import type { PrismaClient } from "@prisma/client";
import { exigirBaseDePruebas } from "./base-de-pruebas";

export async function limpiarPlan(db: PrismaClient, planVersionIds: readonly string[]): Promise<void> {
  const ids = planVersionIds.filter((i) => /^[a-z0-9-]{1,64}$/.test(i));
  if (ids.length === 0) return;
  await exigirBaseDePruebas(db);
  const lista = ids.map((i) => `'${i}'`).join(", ");
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL inv.reversion = 'on'");
    await tx.$executeRawUnsafe(`DELETE FROM alerta_vista WHERE "alertaId" IN (SELECT id FROM alerta WHERE "reglaId" IN (SELECT id FROM regla_plan WHERE "planVersionId" IN (${lista})))`);
    await tx.$executeRawUnsafe(`DELETE FROM alerta WHERE "reglaId" IN (SELECT id FROM regla_plan WHERE "planVersionId" IN (${lista}))`);
    await tx.$executeRawUnsafe(`DELETE FROM regla_plan WHERE "planVersionId" IN (${lista})`);
    await tx.$executeRawUnsafe(`DELETE FROM plan_version WHERE id IN (${lista})`);
  });
}
