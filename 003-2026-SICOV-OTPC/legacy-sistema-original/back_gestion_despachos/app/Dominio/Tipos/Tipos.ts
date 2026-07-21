import { Paginador } from "../Paginador";

export type Paginable<T> = { paginacion: Paginador, datos: T[]; }
export type TipoOrdenamiento = 'asc' | 'desc'
export interface Diccionario {
    [key: string]: string;
  }

export interface TrabajoProgramado {
  id: number
  tipo: string
  estado: string
  reintentos: number
  ultimoError: string | null
  siguienteIntento: string | null
  createdAt: string | null
  updatedAt: string | null
  mantenimientoLocalId: number | null
  detalleId: number | null
  vigiladoId: string | null
  usuarioDocumento: string | null
  payload: Record<string, any> | null
  mantenimiento: Record<string, any> | null
  detalle: Record<string, any> | null
  datosCompletos: Record<string, any> | null
}
