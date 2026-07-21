/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import { RepositorioRol } from 'App/Dominio/Repositorios/RepositorioRol'
import { Rol } from '../Entidades/Autorizacion/Rol'
import { Paginador } from '../../Paginador';
import { Modulo } from '../Entidades/Autorizacion/Modulo';

export class ServicioRol{
  constructor (private repositorio: RepositorioRol) { }

  async obtenerRolporID (id: string): Promise<Rol>{
    return this.repositorio.obtenerRolporID(id)
  }

  /* async guardarRol (rol: Rol): Promise<Rol>{
    return this.repositorio.guardarRol(rol);
  } */

  async obtenerRols (params: any): Promise<{ rols: Rol[], paginacion: Paginador }> {
    return this.repositorio.obtenerRols(params);
  }

  async obtenerModulos (params: any): Promise<{ modulos: Modulo[], paginacion: Paginador }> {
    return this.repositorio.obtenerModulos(params);
  }


}
