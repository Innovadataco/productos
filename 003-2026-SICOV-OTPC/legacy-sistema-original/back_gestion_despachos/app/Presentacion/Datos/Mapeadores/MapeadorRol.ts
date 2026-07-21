import { Rol } from 'App/Dominio/Datos/Entidades/Autorizacion/Rol'
import { RolDatos } from '../Dato/RolDatos'

export class MapeadorRol{
  public static convertirARolDto (rol: Rol): RolDatos{
    let roles = new RolDatos()
    roles.id = rol.id
    roles.estado = rol.estado
    roles.nombre = rol.nombre
    roles.creacion = rol.creacion
    roles.actualizacion = rol.actualizacion
    roles.modulos = rol.modulos

    return roles
  }
}
