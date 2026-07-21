export interface MaestraCodigoDescripcion {
  codigo: number;
  descripcion: string;
}

export interface NivelServicioItem {
  id: number;
  nombre: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Nivel servicio: { array_data: { data: [...] } } o variantes legacy */
export function extraerNivelesServicio(resp: unknown): NivelServicioItem[] {
  if (!resp) return [];
  const root = asRecord(resp);
  const arrayData = asRecord(root?.['array_data']);
  const list = Array.isArray(arrayData?.['data'])
    ? (arrayData['data'] as unknown[])
    : Array.isArray(root?.['data'])
      ? (root['data'] as unknown[])
      : Array.isArray(resp)
        ? (resp as unknown[])
        : [];

  return list
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const id = Number(row['id'] ?? 0);
      const nombre = String(row['nombre'] ?? row['descripcion'] ?? '').trim();
      if (!id || !nombre) return null;
      return { id, nombre };
    })
    .filter((item): item is NivelServicioItem => !!item);
}

/** Clase vehículo / Tipo ID: array directo o wrappers legacy */
export function extraerMaestrasCodigoDescripcion(resp: unknown): MaestraCodigoDescripcion[] {
  if (!resp) return [];
  const root = asRecord(resp);
  const arrayData = asRecord(root?.['array_data']);
  const list = Array.isArray(arrayData?.['data'])
    ? (arrayData['data'] as unknown[])
    : Array.isArray(root?.['data'])
      ? (root['data'] as unknown[])
      : Array.isArray(resp)
        ? (resp as unknown[])
        : [];

  return list
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const codigo = Number(row['codigo'] ?? row['id'] ?? 0);
      const descripcion = String(row['descripcion'] ?? row['nombre'] ?? '').trim();
      if (!codigo || !descripcion) return null;
      return { codigo, descripcion };
    })
    .filter((item): item is MaestraCodigoDescripcion => !!item);
}
