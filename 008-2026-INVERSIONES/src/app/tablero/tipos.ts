/** Datos del tablero ya serializados (texto decimal), listos para cruzar del servidor al cliente. */
export interface FilaVista {
  readonly id: string;
  readonly nemo: string;
  readonly cantidad: string;
  readonly costo: string;
  readonly valor: string | null;
  readonly sinVender: string | null;
  readonly rentabilidadPct: string | null;
  readonly pesoPct: string | null;
  readonly realizada: string;
  readonly dividendos: string;
  readonly comisiones: string;
  readonly cierre: { readonly precio: string; readonly fecha: string; readonly verificado: boolean } | null;
  readonly lotesVivos: number;
  readonly serie: readonly { readonly fecha: string; readonly precio: string }[];
}

export interface Vista {
  readonly filas: FilaVista[];
  readonly cerradas: FilaVista[];
  readonly valorAcciones: string;
  readonly sinVender: string;
  readonly porVentas: string;
  readonly dividendos: string;
  readonly comisiones: string;
  readonly gananciaTotal: string;
  readonly especiesSinPrecio: number;
  readonly ultimoCierre: string | null;
  readonly ultimaCarga: string | null;
  /** Nemotécnicos con ventas que sus lotes no cubren: no entran en filas, cerradas ni totales. */
  readonly incompletas: readonly string[];
}
