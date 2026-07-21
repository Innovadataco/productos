import { Modulo } from 'App/Dominio/Datos/Entidades/Autorizacion/Modulo'
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario'
import TblUsuariosModulos from 'App/Infraestructura/Datos/Entidad/Autorizacion/UsuarioModulo'
import TblModulos from 'App/Infraestructura/Datos/Entidad/Autorizacion/Modulo'
import TblRolesModulos from 'App/Infraestructura/Datos/Entidad/Autorizacion/RolModulo'

export interface RepositorioUsuarioModulo {
  asignarModulosAUsuario(usuarioId: number, modulosIds: number[]): Promise<void>
  removerModulosDeUsuario(usuarioId: number, modulosIds: number[]): Promise<void>
  obtenerModulosDeUsuario(usuarioId: number): Promise<Modulo[]>
  limpiarModulosDeUsuario(usuarioId: number): Promise<void>
}

export class RepositorioUsuarioModuloDB implements RepositorioUsuarioModulo {
  
  async asignarModulosAUsuario(usuarioId: number, modulosIds: number[]): Promise<void> {
    // Verificar que el usuario existe
    const usuario = await TblUsuarios.findOrFail(usuarioId)
    
    // Verificar que todos los módulos existen
    const modulosExistentes = await TblModulos.query()
      .whereIn('mod_id', modulosIds)
      .where('mod_estado', true)
    
    if (modulosExistentes.length !== modulosIds.length) {
      throw new Error('Uno o más módulos no existen o están inactivos')
    }
    
    // 1. ELIMINAR todas las asignaciones anteriores del usuario
    await TblUsuariosModulos.query()
      .where('usm_usuario_id', usuarioId)
      .delete()
    
    // 2. CREAR las nuevas asignaciones
    for (const moduloId of modulosIds) {
      const usuarioModulo = new TblUsuariosModulos()
      usuarioModulo.usuarioId = usuarioId
      usuarioModulo.moduloId = moduloId
      usuarioModulo.estado = true
      await usuarioModulo.save()
    }
  }

  async removerModulosDeUsuario(usuarioId: number, modulosIds: number[]): Promise<void> {
    await TblUsuariosModulos.query()
      .where('usm_usuario_id', usuarioId)
      .whereIn('usm_modulo_id', modulosIds)
      .delete()
  }

  async obtenerModulosDeUsuario(usuarioId: number): Promise<Modulo[]> {
    const usuario = await TblUsuarios.findOrFail(usuarioId)
    
    // Primero intentar obtener módulos personalizados del usuario
    const modulosPersonalizados = await TblUsuariosModulos.query()
      .where('usm_usuario_id', usuarioId)
      .where('usm_estado', true)
      .preload('modulo')
    
    // Si el usuario tiene módulos personalizados, retornar esos
    if (modulosPersonalizados.length > 0) {
      return modulosPersonalizados
        .filter(um => um.modulo && um.modulo.estado)
        .map(um => um.modulo.obtenerModulo())
    }
    
    // Si no tiene módulos personalizados, obtener los del rol
    const modulosRol = await TblRolesModulos.query()
      .where('rom_rol_id', usuario.idRol)
      .preload('modulo')
    
    return modulosRol
      .filter(rm => rm.modulo && rm.modulo.estado)
      .map(rm => rm.modulo.obtenerModulo())
  }

  async limpiarModulosDeUsuario(usuarioId: number): Promise<void> {
    await TblUsuariosModulos.query()
      .where('usm_usuario_id', usuarioId)
      .delete()
  }
}
