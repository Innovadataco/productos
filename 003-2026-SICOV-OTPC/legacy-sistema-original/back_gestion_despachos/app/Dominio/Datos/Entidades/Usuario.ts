import { DateTime } from 'luxon'
export class Usuario{
  id: number;
  usuario: string;
  identificacion: string;
  nombre: string;
  correo: string;
  telefono: string;
  estado: boolean;
  clave: string;
  claveTemporal: boolean;
  idRol: number;
  tokenAutorizado: string;
  administrador: string;
}
