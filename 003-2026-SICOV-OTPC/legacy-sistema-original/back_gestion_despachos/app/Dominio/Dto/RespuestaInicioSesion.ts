/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import { RolDto } from 'App/Presentacion/Autenticacion/Dtos/RolDto'
import { Rol } from '../Datos/Entidades/Autorizacion/Rol'
import { Modulo } from '../Datos/Entidades/Autorizacion/Modulo'

export class RespuestaInicioSesion {

  constructor(
    public readonly usuario: {
      id: number,
      usuario: string,
      nombre?: string,
      apellido?: string,
      telefono?: string,
      correo?: string,
      nit?: string,
    },
    public readonly token: string,
    public readonly tokenExterno: string,
    public readonly tokenParametrica: string,
    public readonly rol: RolDto,
    public readonly claveTemporal: boolean,
    public readonly modulos: Modulo[]
  ) { }
}
