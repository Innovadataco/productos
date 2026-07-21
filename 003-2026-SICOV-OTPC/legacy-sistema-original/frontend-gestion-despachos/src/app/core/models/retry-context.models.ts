export interface RetryContext {
  jobId?: number | null;
  tipoId: number | null;
  tipo?: string | null;
  mantenimientoLocalId?: number | null;
  detalleId?: number | null;
  mantenimientoId?: number | null;
  vigiladoId?: string | number | null;
  usuarioDocumento?: string | number | null;
  payload?: unknown;
  detalle?: unknown;
  datosCompletos?: unknown;
}

export interface RetrySubmit<TPayload = unknown> {
  context: RetryContext;
  payload: TPayload;
}
