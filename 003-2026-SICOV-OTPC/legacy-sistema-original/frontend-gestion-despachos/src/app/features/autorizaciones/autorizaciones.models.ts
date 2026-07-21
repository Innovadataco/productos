import { RegistroAutorizacion, Autorizacion } from '../../mantenimientos/modelos/RegistroAutorizacion';
import { HistorialAutorizacion } from '../../mantenimientos/modelos/Historial';

// Extend / refine legacy interfaces for UI needs
export interface AutorizacionRegistro extends RegistroAutorizacion {
  estado?: boolean; // backend may send boolean active flag
}

export interface AutorizacionDocumento {
  id?: string | number;
  documento: string;
  ruta: string;
  nombreOriginal: string;
  fecha: string; // ISO
  estado?: boolean | null;
  tipo_id?: string | number;
}

export type AutorizacionFormulario = Autorizacion;
export type AutorizacionHistorial = HistorialAutorizacion;

export interface Rango {
  desde: number;
  hasta: number;
  total: number;
}
