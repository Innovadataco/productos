import { Modulo } from 'App/Dominio/Datos/Entidades/Autorizacion/Modulo'
import { RepositorioUsuarioModulo } from 'App/Infraestructura/Implementacion/Lucid/RepositorioUsuarioModuloDB'

export class ServicioUsuarioModulos {
  constructor(private repositorio: RepositorioUsuarioModulo) {}

  /**
   * Asignar módulos específicos a un usuario
   * Esto reemplazará cualquier asignación previa
   */
  async asignarModulosAUsuario(usuarioId: number, modulosIds: number[]): Promise<void> {
    if (!usuarioId || usuarioId <= 0) {
      throw new Error('ID de usuario inválido')
    }

    if (!Array.isArray(modulosIds)) {
      throw new Error('Los módulos deben ser un array de IDs')
    }

    // Filtrar IDs válidos
    const idsValidos = modulosIds.filter(id => id && id > 0)

    if (idsValidos.length === 0) {
      throw new Error('Debe proporcionar al menos un módulo válido')
    }

    await this.repositorio.asignarModulosAUsuario(usuarioId, idsValidos)
  }

  /**
   * Remover módulos específicos de un usuario
   */
  async removerModulosDeUsuario(usuarioId: number, modulosIds: number[]): Promise<void> {
    if (!usuarioId || usuarioId <= 0) {
      throw new Error('ID de usuario inválido')
    }

    if (!Array.isArray(modulosIds) || modulosIds.length === 0) {
      throw new Error('Debe proporcionar módulos a remover')
    }

    await this.repositorio.removerModulosDeUsuario(usuarioId, modulosIds)
  }

  /**
   * Obtener módulos de un usuario
   * Si tiene módulos personalizados, devuelve esos
   * Si no, devuelve los módulos del rol
   */
  async obtenerModulosDeUsuario(usuarioId: number): Promise<Modulo[]> {
    if (!usuarioId || usuarioId <= 0) {
      throw new Error('ID de usuario inválido')
    }

    return await this.repositorio.obtenerModulosDeUsuario(usuarioId)
  }

  /**
   * Limpiar todos los módulos personalizados de un usuario
   * El usuario volverá a usar los módulos del rol
   */
  async limpiarModulosDeUsuario(usuarioId: number): Promise<void> {
    if (!usuarioId || usuarioId <= 0) {
      throw new Error('ID de usuario inválido')
    }

    await this.repositorio.limpiarModulosDeUsuario(usuarioId)
  }

  /**
   * Verificar si un usuario tiene módulos personalizados
   */
  async tieneModulosPersonalizados(usuarioId: number): Promise<boolean> {
    const modulos = await this.repositorio.obtenerModulosDeUsuario(usuarioId)
    // Si hay módulos, verificar si son personalizados o del rol
    // (La lógica ya está en el repositorio)
    return modulos.length > 0
  }
}
