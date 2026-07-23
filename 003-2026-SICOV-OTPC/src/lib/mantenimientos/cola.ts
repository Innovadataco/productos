import type { MantenimientoJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TipoJob } from "@/lib/mantenimientos/tipos";

/// Cola de sincronización de mantenimientos (tbl_mantenimiento_jobs, paridad
/// MantenimientoQueueService). En US1 este módulo solo crea jobs (caída a cola del envío
/// inmediato y carga masiva); el procesamiento por lotes llega con US3.

export interface DatosJob {
  tipo: TipoJob;
  mantenimientoLocalId?: number | null;
  detalleId?: number | null;
  vigiladoId: string;
  usuarioDocumento: string;
  rolId: number;
  payload?: Record<string, unknown> | null;
}

/// Crea un job `pendiente` con intento inmediato (paridad crearJob del legacy).
export async function crearJob(datos: DatosJob): Promise<MantenimientoJob> {
  return prisma.mantenimientoJob.create({
    data: {
      tipo: datos.tipo,
      mantenimientoLocalId: datos.mantenimientoLocalId ?? null,
      detalleId: datos.detalleId ?? null,
      vigiladoId: datos.vigiladoId.slice(0, 30),
      usuarioDocumento: datos.usuarioDocumento.slice(0, 30),
      rolId: datos.rolId,
      estado: "pendiente",
      reintentos: 0,
      siguienteIntento: new Date(),
      payload: (datos.payload ?? undefined) as object | undefined,
    },
  });
}
