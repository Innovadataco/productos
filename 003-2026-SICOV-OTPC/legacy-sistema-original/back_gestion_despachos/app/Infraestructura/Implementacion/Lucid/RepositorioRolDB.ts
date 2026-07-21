/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { Exception } from '@adonisjs/core/build/standalone'
import { Rol } from 'App/Dominio/Datos/Entidades/Autorizacion/Rol'
import { RepositorioRol } from 'App/Dominio/Repositorios/RepositorioRol'
import TblModulos from 'App/Infraestructura/Datos/Entidad/Autorizacion/Modulo'
import TblRoles from 'App/Infraestructura/Datos/Entidad/Autorizacion/Rol'
import { Paginador } from '../../../Dominio/Paginador';
import { MapeadorPaginacionDB } from './MapeadorPaginacionDB';
import { Modulo } from 'App/Dominio/Datos/Entidades/Autorizacion/Modulo'

export class RepositorioRolDB implements RepositorioRol {
  async obtenerRolporID (idRol: string): Promise<Rol> {
    const rolDB = await TblRoles.findOrFail(idRol)
    let rol = rolDB?.obtenerRol()
    if(!rolDB){
      throw new Exception(`No existe el rol ${idRol}`, 404)
    }
    console.log('rol', rolDB)
    const modulos = await TblModulos.query().join('tbl_roles_modulos', (consulta)=> {
      consulta.on('tbl_modulos.mod_id', '=', 'tbl_roles_modulos.rom_modulo_id')
    }).where('tbl_roles_modulos.rom_rol_id', '=', idRol)
    console.log('modulos', modulos)
    modulos.forEach((modulo) => {
      rol.agregarModulo(modulo.obtenerModulo())
    })
    return rol
  }

  async obtenerRols (params: any): Promise<{rols: Rol[], paginacion: Paginador}> {
    const rols: Rol[] = []
    const rolesBD = await TblRoles.query().where('rol_root', false).orderBy('rol_nombre', 'desc').paginate(params.pagina, params.limite)
    rolesBD.forEach(rolesBD => {
      rols.push(rolesBD.obtenerRol())
    })
    const paginacion = MapeadorPaginacionDB.obtenerPaginacion(rolesBD)
    return {rols , paginacion}
  }

    async obtenerModulos (params: any): Promise<{modulos: Modulo[], paginacion: Paginador}> {
    const modulos: Modulo[] = []
    const modulosBD = await TblModulos.query().orderBy('mod_nombre', 'desc').where('mod_estado', true).paginate(params.pagina, params.limite)
    modulosBD.forEach(moduloBD => {
      modulos.push(moduloBD.obtenerModulo())
    })
    const paginacion = MapeadorPaginacionDB.obtenerPaginacion(modulosBD)
    return {modulos , paginacion}
  }

}
