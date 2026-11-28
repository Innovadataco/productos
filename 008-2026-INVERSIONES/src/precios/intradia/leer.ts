/**
 * Lectores de los precios intradía, para la app y para las alertas (solo lectura: la app corre como inv_app, que no escribe
 * esta tabla). Cada precio trae su instante (la hora de la barra), su fuente y si Yahoo la marcó con retraso: nunca se
 * presenta como de ahora. Los días son los de Colombia (UTC−5).
 */
import type { Prisma, PrismaClient } from "@prisma/client";

export interface PrecioIntradiaLeido {
  readonly instante: Date;
  readonly precio: Prisma.Decimal;
  readonly fuente: string;
  readonly conRetraso: boolean;
}

const SELECCION = { instante: true, precio: true, fuente: true, conRetraso: true } as const;
const DIA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DESFASE_COT_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** La barra más reciente de la especie, o null si no hay ninguna. */
export async function ultimoPrecioIntradia(db: Pick<PrismaClient, "precioIntradia">, instrumentoId: string): Promise<PrecioIntradiaLeido | null> {
  return db.precioIntradia.findFirst({ where: { instrumentoId }, orderBy: { instante: "desc" }, select: SELECCION });
}

/** Las barras de la especie en un día de Colombia (`AAAA-MM-DD`), de la más vieja a la más nueva. Un día mal escrito lanza RangeError. */
export async function preciosDelDia(db: Pick<PrismaClient, "precioIntradia">, instrumentoId: string, dia: string): Promise<PrecioIntradiaLeido[]> {
  const m = DIA_RE.exec(dia);
  const inicioUtc = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Number.NaN;
  if (Number.isNaN(inicioUtc) || new Date(inicioUtc).toISOString().slice(0, 10) !== dia) throw new RangeError("preciosDelDia: el día debe ser AAAA-MM-DD");
  const desde = new Date(inicioUtc + DESFASE_COT_MS);
  return db.precioIntradia.findMany({ where: { instrumentoId, instante: { gte: desde, lt: new Date(desde.getTime() + DIA_MS) } }, orderBy: { instante: "asc" }, select: SELECCION });
}
