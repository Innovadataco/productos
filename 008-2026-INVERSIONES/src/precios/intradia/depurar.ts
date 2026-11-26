/**
 * La retención de los precios intradía (el job de depuración del servicio de precios: una vez al día, antes del primer ciclo).
 * Borra lo de más de `retencionDias` días. Es lo único que borra precio_intradia (la tabla es de solo inserción; su
 * disparador inv_precio_intradia_retiro solo deja borrar filas de más de 60 días, así que la retención mínima es 60: eso son
 * siempre al menos 30 días hábiles de la BVC). El corte lleva una hora de margen por si el reloj del servicio y el de la base
 * no coinciden: nunca pide borrar algo que la base no deje. Candado: tests/unit/precios/intradia-camino-unico.test.ts.
 */
import type { PrismaClient } from "@prisma/client";

export const RETENCION_MINIMA_DIAS = 60;
const DIA_MS = 24 * 60 * 60 * 1000;
const MARGEN_RELOJ_MS = 60 * 60 * 1000;

/** Borra los precios de más de `retencionDias` días y devuelve cuántos. Con menos de 60 días se niega antes de tocar la base. */
export async function depurarIntradia(db: Pick<PrismaClient, "precioIntradia">, ahora: Date, retencionDias: number): Promise<number> {
  if (!Number.isInteger(retencionDias) || retencionDias < RETENCION_MINIMA_DIAS) {
    throw new RangeError(`depurarIntradia: la retención mínima es de ${RETENCION_MINIMA_DIAS} días`);
  }
  const corte = new Date(ahora.getTime() - retencionDias * DIA_MS - MARGEN_RELOJ_MS);
  const r = await db.precioIntradia.deleteMany({ where: { instante: { lt: corte } } });
  return r.count;
}
