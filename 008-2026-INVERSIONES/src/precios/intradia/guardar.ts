/**
 * El camino ÚNICO de escritura de precio_intradia (con `depurar.ts`, que solo borra la retención): guarda las barras de 1
 * minuto de una especie sin duplicar. `createMany` con `skipDuplicates` es un INSERT … ON CONFLICT DO NOTHING sobre el índice
 * único (especie, instante, fuente): traer la misma barra otra vez no escribe nada y la primera que llegó se queda. La hora
 * de traída y los topes los pone la base (disparador inv_precio_intradia_insercion). Candado:
 * tests/unit/precios/intradia-camino-unico.test.ts.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type { BarraIntradia } from "./yahoo";

/** Fuente de las barras: Yahoo. Es la única que acepta la base. */
export const FUENTE_INTRADIA = "yahoo";

/** Guarda las barras de una especie y devuelve cuántas eran nuevas. */
export async function guardarBarras(db: Pick<PrismaClient, "precioIntradia">, instrumentoId: string, barras: readonly BarraIntradia[], conRetraso: boolean): Promise<number> {
  if (barras.length === 0) return 0;
  const r = await db.precioIntradia.createMany({
    data: barras.map((b) => ({ instrumentoId, instante: b.instante, precio: new Prisma.Decimal(b.precio), fuente: FUENTE_INTRADIA, conRetraso })),
    skipDuplicates: true,
  });
  return r.count;
}
