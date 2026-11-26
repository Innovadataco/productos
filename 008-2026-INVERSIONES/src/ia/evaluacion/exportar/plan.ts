/**
 * Los lectores del plan para los hechos (E7, y la corrida del servicio inv-008-ia, que lee con el rol `inv_ia`), con el
 * `select` acotado a lo que usan `vigenteEn` y el armador REGLAS (`ReglaParaHechos`). No son los de la página del plan
 * (`leerVersiones` y `leerReglas` de src/plan/lectura.ts): esos leen el motivo de la versión (texto libre del dueño), la
 * acción, la cantidad y el detalle de cada regla, y cuentan reglas, lotes y decisiones, columnas y tablas que `inv_ia`
 * NO tiene a propósito (docker/migrador/privilegios.sql, lista única tests/unit/ia/registro/permisos-ia.ts): con
 * `inv_ia` dan 42501 («permission denied for table plan_version»). Lo que se lee aquí ya está concedido a `inv_ia`:
 * de plan_version, id, version y vigenteDesde; de regla_plan, id, planVersionId, instrumentoId, condicion, nivel y
 * plazoHasta; de instrumento, id y nemotecnico. Ninguna columna nueva.
 */
import type { PrismaClient } from "@prisma/client";
import type { ReglaParaHechos } from "../../hechos";

export interface VersionVigenteParaHechos {
  readonly id: string;
  readonly vigenteDesde: Date;
}

/**
 * La versión que rige `hoy`: la de mayor número con `vigenteDesde` ≤ hoy (la misma regla que `vigenteEn` de
 * src/app/plan/vista.ts, aquí en la consulta), o null si no rige ninguna.
 */
export async function versionVigenteParaHechos(c: PrismaClient, hoy: Date): Promise<VersionVigenteParaHechos | null> {
  const v = await c.planVersion.findFirst({ where: { vigenteDesde: { lte: hoy } }, orderBy: { version: "desc" }, select: { id: true, vigenteDesde: true } });
  return v === null ? null : Object.freeze({ id: v.id, vigenteDesde: v.vigenteDesde });
}

/** Las reglas de la versión, en el orden de `leerReglas` (por id), solo con lo que lee el armador REGLAS. */
export async function reglasParaHechos(c: PrismaClient, planVersionId: string): Promise<readonly ReglaParaHechos[]> {
  const filas = await c.reglaPlan.findMany({
    where: { planVersionId },
    select: { instrumentoId: true, condicion: true, nivel: true, plazoHasta: true, instrumento: { select: { nemotecnico: true } } },
    orderBy: { id: "asc" },
  });
  return Object.freeze(
    filas.map(({ instrumento, ...r }) => Object.freeze({ instrumentoId: r.instrumentoId, nemotecnico: instrumento?.nemotecnico ?? null, condicion: r.condicion, nivel: r.nivel, plazoHasta: r.plazoHasta })),
  );
}
