import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { ObtenerResumenDashboard } from 'App/Dominio/Datos/ObtenerResumenDashboard'
import { RepositorioMantenimientoDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioMantenimientoDB'

export default class ControladorDashboard {
  private obtenerResumenDashboard: ObtenerResumenDashboard
  private repositorioMantenimiento: RepositorioMantenimientoDB

  constructor() {
    this.repositorioMantenimiento = new RepositorioMantenimientoDB()
    this.obtenerResumenDashboard = new ObtenerResumenDashboard(this.repositorioMantenimiento)
  }

  /**
   * Obtiene el resumen de mantenimientos y novedades agrupados por empresa
   * GET /dashboard
   * Query params:
   *   - nit (opcional): Filtra por ese NIT específico
   *   - fechaInicio (opcional): Fecha inicio en formato YYYY-MM-DD
   *   - fechaFin (opcional): Fecha fin en formato YYYY-MM-DD
   */
  public async obtenerResumen({ request, response }: HttpContextContract) {
    try {
      const { nit, fechaInicio, fechaFin } = request.qs()

      const resumen = await this.obtenerResumenDashboard.ejecutar(nit, fechaInicio, fechaFin)

      return response.status(200).json(resumen)
    } catch (error) {
      console.error('Error al obtener resumen del dashboard:', error)
      return response.status(500).json({
        mensaje: 'Error al obtener el resumen del dashboard',
        error: error.message
      })
    }
  }

  /**
   * Obtiene el listado de placas (siempre tipo 1 - preventivo)
   * GET /dashboard/placas
   * Query params:
   *   - placa (opcional): Filtra por una placa específica
   *   - nit (opcional): Filtra por NIT de empresa
   */
  public async obtenerPlacas({ request, response }: HttpContextContract) {
    try {
      const { placa, nit } = request.qs()

      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento
      const idRol = payload.idRol

      const placas = await this.obtenerResumenDashboard.obtenerPlacas(
        usuario,
        idRol,
        placa,
        nit
      )

      return response.status(200).json(placas)
    } catch (error) {
      console.error('Error al obtener placas del dashboard:', error)
      return response.status(500).json({
        mensaje: 'Error al obtener las placas del dashboard',
        error: error.message
      })
    }
  }

  /**
   * Obtiene los logs de mantenimientos con información detallada
   * GET /dashboard/logs
   * Query params:
   *   - nit (opcional): Filtra por NIT de empresa
   */
  public async obtenerLogs({ request, response }: HttpContextContract) {
    try {
      const { nit } = request.qs()

      const logs = await this.obtenerResumenDashboard.obtenerLogsMantenimiento(nit)

      return response.status(200).json(logs)
    } catch (error) {
      console.error('Error al obtener logs de mantenimiento:', error)
      return response.status(500).json({
        mensaje: 'Error al obtener los logs de mantenimiento',
        error: error.message
      })
    }
  }
}
