/**
 * Filtros de metadatos para la búsqueda híbrida (spec 003, FR-014, FR-022).
 *
 * Se aplican **antes** de ambas ramas (FTS y vectorial) y **siempre** excluyen
 * los documentos inactivos (`activo = false`, FR-022/SC-015). Se componen con
 * `Prisma.sql`/`Prisma.join`: los valores viajan **parametrizados**, nunca por
 * concatenación (FR-012).
 */

import { Prisma } from "@prisma/client";

export interface FiltrosBusqueda {
  tipo?: string;
  entidad?: string;
  sector?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

/**
 * Devuelve un `Prisma.Sql` con las condiciones `AND ...` sobre la tabla `d`
 * (alias de `DocumentoOficial`). Incluye siempre `d."activo" = true`.
 */
export function construirFiltros(filtros: FiltrosBusqueda): Prisma.Sql {
  const condiciones: Prisma.Sql[] = [Prisma.sql`d."activo" = true`];

  if (filtros.tipo) condiciones.push(Prisma.sql`d."tipo" = ${filtros.tipo}`);
  if (filtros.entidad) condiciones.push(Prisma.sql`d."entidad" = ${filtros.entidad}`);
  if (filtros.sector) condiciones.push(Prisma.sql`d."sector" = ${filtros.sector}`);
  if (filtros.fechaDesde) {
    condiciones.push(Prisma.sql`d."fechaExpedicion" >= ${new Date(filtros.fechaDesde)}`);
  }
  if (filtros.fechaHasta) {
    condiciones.push(Prisma.sql`d."fechaExpedicion" <= ${new Date(filtros.fechaHasta)}`);
  }

  return Prisma.join(condiciones, " AND ");
}
