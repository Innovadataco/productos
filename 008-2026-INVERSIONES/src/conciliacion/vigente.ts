/**
 * «La certificación de una fecha de corte» (frente certificacion-corte-real). Una certificación cargada con el corte
 * equivocado se RETIRA (src/importacion/av/corregir.ts): sigue en la base, con su fecha, como historia, y la
 * reemplaza la del corte real. Por eso nadie la busca por fecha a mano (candado:
 * tests/unit/conciliacion/certificacion-vigente.test.ts): la vigente, para leer y conciliar; lo que ocupa la fecha
 * (vigente o retirada, con la fecha de su reemplazo), para importar y para decir por qué no se concilia.
 */
import type { Prisma } from "@prisma/client";
import { isoDia } from "../importacion/av/fecha-corte";

type Lector = Pick<Prisma.TransactionClient, "certificacion">;

/** La certificación VIGENTE de esa fecha de corte (id, fecha y carga), o null. */
export function certificacionVigente(db: Lector, fechaCorte: Date): Promise<{ id: string; fechaCorte: Date; cargaId: string } | null> {
  return db.certificacion.findFirst({ where: { fechaCorte, retiradaEn: null }, select: { id: true, fechaCorte: true, cargaId: true } });
}

export interface CorteOcupado {
  readonly id: string;
  readonly cargaId: string;
  /** null si está vigente; si está retirada, la fecha de corte (AAAA-MM-DD) de la que la reemplazó. */
  readonly reemplazo: string | null;
}

/** Lo que ocupa esa fecha de corte (la fecha es única: vigente o retirada), o null si nada. */
export async function corteOcupado(db: Lector, fechaCorte: Date): Promise<CorteOcupado | null> {
  const c = await db.certificacion.findUnique({
    where: { fechaCorte },
    select: { id: true, cargaId: true, retiradaEn: true, reemplazadaPor: { select: { fechaCorte: true } } },
  });
  if (!c) return null;
  // La base exige el reemplazo con el retiro (certificacion_retiro_chk).
  return { id: c.id, cargaId: c.cargaId, reemplazo: c.retiradaEn === null || c.reemplazadaPor === null ? null : isoDia(c.reemplazadaPor.fechaCorte) };
}
