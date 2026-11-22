import "server-only";
/**
 * Los decretos que cuentan (fase C, C5c): los VIGENTES (sin reemplazo: una corrección es la versión siguiente y retira a
 * la anterior) y no anulados (una anulación es una versión `anulada`). Es el único filtro: lo usan el lector de la
 * pantalla (leer.ts), el del motor de proyecciones (src/proyecciones/leer.ts) y los dividendos del plan
 * (src/plan/resultados-lote.ts, con leerFechasDeDecretos). Solo lectura, con `select` explícito: nunca la fila de origen
 * cifrada.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { sumarDias } from "../../plan/fechas";
import { VENTANA_PAGO_ANTES_DIAS, VENTANA_PAGO_DESPUES_DIAS } from "./ventana";

type Db = PrismaClient | Prisma.TransactionClient;

/** Va al final del `where`: ninguna condición del llamador lo pisa. */
export const DECRETOS_QUE_CUENTAN = { reemplazadoEn: null, anulada: false } as const satisfies Prisma.DividendoDecretadoWhereInput;

/** Un rango de fechas, con los dos bordes incluidos. */
export interface RangoDeFechas {
  readonly desde: Date;
  readonly hasta: Date;
}

/** Las fechas de pago de los decretos cuya ventana (ventana.ts) puede contener un pago de Trii del rango `pagos`. */
export function rangoDeDecretos(pagos: RangoDeFechas): RangoDeFechas {
  return { desde: sumarDias(pagos.desde, -VENTANA_PAGO_DESPUES_DIAS), hasta: sumarDias(pagos.hasta, VENTANA_PAGO_ANTES_DIAS) };
}

/** Lo que el plan necesita de un decreto que cuenta: su especie y sus fechas. */
export interface FechasDeDecreto {
  readonly instrumentoId: string;
  readonly fechaEx: Date;
  readonly fechaPago: Date;
}

/**
 * Los decretos que cuentan de cada especie de `pagosPorEspecie`, con la fecha de pago en el rango de decretos de sus
 * pagos (rangoDeDecretos). Una sola consulta, por especie e índice (instrumentoId, fechaPago).
 */
export function leerFechasDeDecretos(db: Db, pagosPorEspecie: ReadonlyMap<string, RangoDeFechas>): Promise<FechasDeDecreto[]> {
  const porEspecie = [...pagosPorEspecie].map(([instrumentoId, pagos]) => {
    const { desde, hasta } = rangoDeDecretos(pagos);
    return { instrumentoId, fechaPago: { gte: desde, lte: hasta } };
  });
  return db.dividendoDecretado.findMany({
    where: { OR: porEspecie, ...DECRETOS_QUE_CUENTAN },
    select: { instrumentoId: true, fechaEx: true, fechaPago: true },
    orderBy: [{ instrumentoId: "asc" }, { fechaPago: "asc" }, { fechaEx: "asc" }, { id: "asc" }],
  });
}
