/**
 * Las especies a las que se les piden precios cada minuto: acciones activas con nemotécnico que tienen posición (un lote) o
 * una regla en la versión VIGENTE del plan (la de mayor número con vigencia hasta hoy). Las reglas del portafolio, sin especie,
 * no cuentan. Se leen solo la versión y la especie de la regla (docker/migrador/privilegios.sql): ni la acción, ni la
 * cantidad, ni el nivel. Ordenadas por nemotécnico, para que un ciclo recorra siempre el mismo orden.
 */
import type { PrismaClient } from "@prisma/client";

export interface EspecieIntradia {
  readonly id: string;
  readonly nemotecnico: string;
}

export async function especiesIntradia(db: Pick<PrismaClient, "instrumento" | "planVersion" | "reglaPlan">, hoy: Date): Promise<EspecieIntradia[]> {
  const version = await db.planVersion.findFirst({ where: { vigenteDesde: { lte: hoy } }, orderBy: { version: "desc" }, select: { id: true } });
  const reglas = version ? await db.reglaPlan.findMany({ where: { planVersionId: version.id, instrumentoId: { not: null } }, select: { instrumentoId: true } }) : [];
  const conRegla = [...new Set(reglas.flatMap((r) => (r.instrumentoId === null ? [] : [r.instrumentoId])))];
  const filas = await db.instrumento.findMany({
    where: { tipo: "ACCION", activo: true, nemotecnico: { not: null }, OR: [{ lotes: { some: {} } }, ...(conRegla.length > 0 ? [{ id: { in: conRegla } }] : [])] },
    select: { id: true, nemotecnico: true },
    orderBy: { nemotecnico: "asc" },
  });
  return filas.flatMap((f) => (f.nemotecnico === null ? [] : [{ id: f.id, nemotecnico: f.nemotecnico }]));
}
