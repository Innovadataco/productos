/// Consulta paginada de la bitácora de la consola (`tbl_api_llamadas`, spec 013). Solo lectura.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolverPagina, construirPaginado, type Paginado } from "@/lib/paginacion";

export interface FiltrosBitacora {
  operacion?: string | null;
  modo?: string | null;
  status?: string | null;
  desde?: string | null;
  hasta?: string | null;
}

export interface LlamadaFila {
  id: number;
  usuarioId: number;
  operacion: string;
  modo: string;
  status: number | null;
  duracionMs: number | null;
  error: string | null;
  creado: Date | null;
}

/// Listado paginado server-side (P1, §4.3) con filtros por operación, modo, status y rango de fecha.
export async function listarLlamadas(f: FiltrosBitacora, page?: unknown, pageSize?: unknown): Promise<Paginado<LlamadaFila>> {
  const pagina = resolverPagina(page, pageSize);
  const where: Prisma.ApiLlamadaWhereInput = {};
  if (f.operacion) where.operacion = f.operacion;
  if (f.modo) where.modo = f.modo;
  if (f.status) where.status = Number.parseInt(f.status, 10) || undefined;
  if (f.desde || f.hasta) {
    where.creado = {};
    if (f.desde) where.creado.gte = new Date(f.desde);
    if (f.hasta) where.creado.lte = new Date(f.hasta);
  }

  const [filas, total] = await Promise.all([
    prisma.apiLlamada.findMany({
      where,
      orderBy: { id: "desc" },
      skip: pagina.skip,
      take: pagina.take,
      select: { id: true, usuarioId: true, operacion: true, modo: true, status: true, duracionMs: true, error: true, creado: true },
    }),
    prisma.apiLlamada.count({ where }),
  ]);
  return construirPaginado(filas, total, pagina);
}
