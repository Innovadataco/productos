// Limpieza de las especies de prueba (con sus órdenes, lotes, cierres, barras, decretos y alertas) en la base COMPARTIDA de las
// pruebas de integración: otros archivos cuentan las especies con lote o con regla (precios cada minuto), las órdenes y los lotes de
// antes de 2023 (conciliación), así que lo que una prueba siembra no puede quedar para las que corren después (el orden de los
// archivos cambia de una corrida a otra). Las tablas son de solo inserción: el borrado va en una transacción con
// `SET LOCAL inv.reversion = 'on'` (el procedimiento de corrección del dueño; inv_solo_insercion lo admite) y, en las barras,
// el mismo disparador de la retención. Borra en el orden de las llaves. No es una prueba (no termina en .test.ts).
import type { PrismaClient } from "@prisma/client";
import { exigirBaseDePruebas } from "./base-de-pruebas";

const ID = /^[a-z0-9-]{1,64}$/;
const lista = (ids: readonly string[]): string => ids.filter((i) => ID.test(i)).map((i) => `'${i}'`).join(", ");

export interface Siembra {
  readonly instrumentos: readonly string[];
  /** Las cargas de archivo que sembraron las filas (órdenes, decretos): con sus filas de origen. */
  readonly cargas: readonly string[];
  /**
   * Los decretos creados a mano: un decreto no se borra (dividendo_decretado se retira con `reemplazadoEn`), así que se retira, y su
   * especie, su fila de origen y su carga quedan (sin lote ni regla, ninguna cuenta las ve).
   */
  readonly decretos?: readonly string[];
}

export async function limpiarEspecies(db: PrismaClient, s: Siembra): Promise<void> {
  const e = lista(s.instrumentos);
  const c = lista(s.cargas);
  const d = lista(s.decretos ?? []);
  if (e === "" && c === "") return;
  await exigirBaseDePruebas(db);
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL inv.reversion = 'on'");
    if (e !== "") {
      await tx.$executeRawUnsafe(`DELETE FROM alerta_vista WHERE "alertaId" IN (SELECT id FROM alerta WHERE "instrumentoId" IN (${e}))`);
      await tx.$executeRawUnsafe(`DELETE FROM alerta WHERE "instrumentoId" IN (${e})`);
      await tx.$executeRawUnsafe(`DELETE FROM precio_intradia WHERE "instrumentoId" IN (${e})`);
      await tx.$executeRawUnsafe(`DELETE FROM precio_cierre WHERE "instrumentoId" IN (${e})`);
    }
    if (d !== "") await tx.$executeRawUnsafe(`UPDATE dividendo_decretado SET "reemplazadoEn" = now() WHERE id IN (${d}) AND "reemplazadoEn" IS NULL`);
    if (e !== "") {
      await tx.$executeRawUnsafe(`DELETE FROM lote WHERE "instrumentoId" IN (${e})`);
      await tx.$executeRawUnsafe(`DELETE FROM orden WHERE "instrumentoId" IN (${e})`);
    }
    if (c !== "") {
      await tx.$executeRawUnsafe(`DELETE FROM fila_de_carga WHERE "cargaId" IN (${c})`);
      await tx.$executeRawUnsafe(`DELETE FROM fila_fuente WHERE "primeraCargaId" IN (${c})`);
      await tx.$executeRawUnsafe(`DELETE FROM carga_archivo WHERE id IN (${c})`);
    }
    if (e !== "") await tx.$executeRawUnsafe(`DELETE FROM instrumento i WHERE i.id IN (${e}) AND NOT EXISTS (SELECT 1 FROM dividendo_decretado d WHERE d."instrumentoId" = i.id)`);
  });
}
