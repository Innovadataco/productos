import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { ServicioUsuarioModulos } from 'App/Dominio/Datos/Servicios/ServicioUsuarioModulos'
import { RepositorioUsuarioModuloDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioUsuarioModuloDB'
import CustomException from 'App/Exceptions/CustomException'

export default class ControladorUsuarioModulos {
  private servicio: ServicioUsuarioModulos

  constructor() {
    this.servicio = new ServicioUsuarioModulos(new RepositorioUsuarioModuloDB())
  }

  /**
   * Asignar módulos personalizados a un usuario
   * POST /api/v1/usuarios/:id/modulos
   * Body: { modulos: [1, 2, 3] }
   */
  public async asignarModulos({ params, request, response }: HttpContextContract) {
    try {
      const usuarioId = params.id
      const { modulos } = request.only(['modulos'])

      if (!modulos || !Array.isArray(modulos)) {
        return CustomException.error(
          response,
          400,
          'Datos inválidos',
          ['Debe proporcionar un array de IDs de módulos']
        )
      }

      await this.servicio.asignarModulosAUsuario(usuarioId, modulos)

      return CustomException.success(
        response,
        200,
        'Módulos asignados',
        ['Los módulos han sido asignados correctamente al usuario']
      )
    } catch (error) {
      return CustomException.error(
        response,
        500,
        'Error al asignar módulos',
        [error.message]
      )
    }
  }

  /**
   * Obtener módulos de un usuario
   * GET /api/v1/usuarios/:id/modulos
   */
  public async obtenerModulos({ params, response }: HttpContextContract) {
    try {
      const usuarioId = params.id
      const modulos = await this.servicio.obtenerModulosDeUsuario(usuarioId)

      return CustomException.success(
        response,
        200,
        'Módulos del usuario',
        ['Módulos obtenidos exitosamente'],
        { modulos }
      )
    } catch (error) {
      return CustomException.error(
        response,
        500,
        'Error al obtener módulos',
        [error.message]
      )
    }
  }

  /**
   * Remover módulos específicos de un usuario
   * DELETE /api/v1/usuarios/:id/modulos
   * Body: { modulos: [1, 2, 3] }
   */
  public async removerModulos({ params, request, response }: HttpContextContract) {
    try {
      const usuarioId = params.id
      const { modulos } = request.only(['modulos'])

      if (!modulos || !Array.isArray(modulos)) {
        return CustomException.error(
          response,
          400,
          'Datos inválidos',
          ['Debe proporcionar un array de IDs de módulos']
        )
      }

      await this.servicio.removerModulosDeUsuario(usuarioId, modulos)

      return CustomException.success(
        response,
        200,
        'Módulos removidos',
        ['Los módulos han sido removidos correctamente']
      )
    } catch (error) {
      return CustomException.error(
        response,
        500,
        'Error al remover módulos',
        [error.message]
      )
    }
  }

  /**
   * Limpiar todos los módulos personalizados del usuario
   * El usuario volverá a usar los módulos del rol
   * DELETE /api/v1/usuarios/:id/modulos/limpiar
   */
  public async limpiarModulos({ params, response }: HttpContextContract) {
    try {
      const usuarioId = params.id
      await this.servicio.limpiarModulosDeUsuario(usuarioId)

      return CustomException.success(
        response,
        200,
        'Módulos limpiados',
        ['El usuario ahora usará los módulos de su rol']
      )
    } catch (error) {
      return CustomException.error(
        response,
        500,
        'Error al limpiar módulos',
        [error.message]
      )
    }
  }
}
