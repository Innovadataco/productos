import { Modulo } from "App/Dominio/Datos/Entidades/Autorizacion/Modulo";
import { Rol } from "App/Dominio/Datos/Entidades/Autorizacion/Rol";
import { RepositorioAutorizacion } from "App/Dominio/Repositorios/RepositorioAutorizacion";
import TblModulos from "App/Infraestructura/Datos/Entidad/Autorizacion/Modulo";
import TblRoles from "App/Infraestructura/Datos/Entidad/Autorizacion/Rol";
import TblSubmodulos from "App/Infraestructura/Datos/Entidad/Autorizacion/Submodulo";

export class RepositorioAutorizacionDB implements RepositorioAutorizacion {
    private readonly TABLA_ROLES = 'tbl_roles'
    private readonly TABLA_ROLES_MODULOS = 'tbl_roles_modulos'
    private readonly TABLA_MODULOS = 'tbl_modulos'
    private readonly TABLA_SUBMODULOS = 'tbl_submodulos'

    async obtenerRolConModulosYPermisos(idRol: number): Promise<Rol> {
        const rol = (await TblRoles.findOrFail(idRol)).obtenerRol()
        let modulos = await this.obtenerModulosDeUnRol(idRol)
        modulos = await this.obtenerFuncionalidadesModulos(modulos)
        modulos.forEach(modulo => {
            rol.agregarModulo(modulo)
        })


        return rol
    }

    private async obtenerModulosDeUnRol(idRol: number): Promise<Modulo[]> {
        const modulosDb = await TblModulos.query()
            .innerJoin(this.TABLA_ROLES_MODULOS, `${this.TABLA_MODULOS}.mod_id`, '=', `${this.TABLA_ROLES_MODULOS}.rom_modulo_id`)
            .innerJoin(this.TABLA_ROLES, `${this.TABLA_ROLES}.rol_id`, '=', `${this.TABLA_ROLES_MODULOS}.rom_rol_id`)
            .where(`${this.TABLA_ROLES}.rol_id`, idRol)
            .orderBy(`${this.TABLA_MODULOS}.mod_orden`, 'asc')
        return modulosDb.map(moduloDb => {
            return moduloDb.obtenerModulo()
        })
    }

    private async obtenerFuncionalidadesModulos(modulos: Modulo[]): Promise<Modulo[]> {
        const submodulosDb = await TblSubmodulos.query()
            .whereIn('smod_modulo', modulos.map(modulo => modulo.id))
            .orderBy('smod_id', 'asc')
        //Funcionalidades por modulos obtenidas
        modulos.forEach(modulo => {
            submodulosDb.forEach(submodulosDb => {
                if (modulo.id == Number(submodulosDb.idModulo)) {
                    modulo.agregarSubmodulo(submodulosDb.obtenerSubmodulo())
                }
            })
        })
        return modulos
    }
}
