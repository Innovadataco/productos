import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { RepositorioUsuarioModuloDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioUsuarioModuloDB'

/**
 * Middleware para verificar si un usuario tiene acceso a un módulo específico
 *
 * Uso en las rutas:
 * Route.get('/algo', 'Controlador.metodo').middleware('autenticacionJwt').middleware('verificarModulo:nombre_modulo')
 *
 * Ejemplo:
 * Route.get('/usuarios', 'ControladorUsuario.listar').middleware('verificarModulo:usuarios')
 */
export default class VerificarModulo {
  private repositorioModulo: RepositorioUsuarioModuloDB

  constructor() {
    this.repositorioModulo = new RepositorioUsuarioModuloDB()
  }

  public async handle(
    { request, response }: HttpContextContract,
    next: () => Promise<void>,
    modulosPermitidos: string[]
  ) {
    try {
      // Obtener el payload JWT del request (ya validado por autenticacionJwt)
      const payload = await request.obtenerPayloadJWT()

      if (!payload || !payload.id) {
        return response.status(401).json({
          mensaje: 'Usuario no autenticado',
          error: 1
        })
      }

      // Obtener módulos del usuario
      const modulosUsuario = await this.repositorioModulo.obtenerModulosDeUsuario(payload.id)

      // Convertir nombres de módulos a minúsculas para comparación
      const nombresModulosUsuario = modulosUsuario.map(m => m.nombre.toLowerCase())

      // Verificar si el usuario tiene acceso a alguno de los módulos permitidos
      const tieneAcceso = modulosPermitidos.some(modulo =>
        nombresModulosUsuario.includes(modulo.toLowerCase())
      )

      if (!tieneAcceso) {
        return response.status(403).json({
          mensaje: 'No tiene permisos para acceder a este módulo',
          error: 1,
          modulosRequeridos: modulosPermitidos,
          modulosUsuario: nombresModulosUsuario
        })
      }

      // Usuario tiene acceso, continuar
      await next()
    } catch (error) {
      return response.status(500).json({
        mensaje: 'Error al verificar permisos',
        error: 1,
        detalle: error.message
      })
    }
  }
}
