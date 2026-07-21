export interface Salida {
  id?: number;
  nitEmpresaTransporte?: string;
  razonSocial?: string;
  tipoDespacho?: number;
  numeroPasajero?: number;
  valorTiquete?: string;
  valorTotalTasaUso?: string;
  observaciones?: string;
  estado?: boolean;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  fuenteDato?: string;
  fechaSalida?: string;
  horaSalida?: string;
  placa?: string;
  llegadas?: unknown[];
}

export interface CrearSalida {
  nitEmpresaTransporte: string;
  razonSocial: string;
  tipoDespacho: number;
  numeroPasajero: number;
  fechaSalida: string; // ISO date (yyyy-MM-dd)
  horaSalida: string;  // HH:mm
  valorTiquete?: string;
  valorTotalTasaUso?: string;
  observaciones?: string;
}
