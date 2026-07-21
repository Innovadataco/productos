import { HistorialAlistamiento } from '../../mantenimientos/modelos/Historial';
import { RegistroMantenimiento } from '../../mantenimientos/modelos/RegistroMantenimiento';
import { DetallesActividades, ProtocoloAlistamiento } from '../../mantenimientos/modelos/RegistroProtocoloAlistamiento';

export interface AlistamientoDocumento {
  documento: string;
  ruta: string;
  nombreOriginal: string;
  fecha?: string;
  estado?: boolean;
  tipo_id?: number;
  id?: number;
}

export interface AlistamientoRegistro extends RegistroMantenimiento {
  mantenimiento_id?: string | number;
  estado?: boolean | string;
}

export type { HistorialAlistamiento, DetallesActividades, ProtocoloAlistamiento, RegistroMantenimiento };

export interface GuardarAlistamientoEvent {
  mantenimientoId?: string | number;
  protocolo: ProtocoloAlistamiento;
  placa: string;
}
