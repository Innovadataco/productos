/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { Exception } from '@adonisjs/core/build/standalone'
import { ServicioSolicitudLlegada } from 'App/Dominio/Datos/Servicios/ServicioSolicitudLlegada'
import { guardarLogError } from 'App/Dominio/guardarLogError'
import { obtenerCredencialesJwt, manejarErrorIntegracion } from 'App/Presentacion/Integracion/utilidadesIntegracion'

export default class ControladorIntegracionLlegadas {
  private servicio = new ServicioSolicitudLlegada()

  public async registrar ({ request, response }: HttpContextContract) {
    try {
      const { documento, idRol } = await obtenerCredencialesJwt(request)
      const payload = request.all()

      if (!payload || Object.keys(payload).length === 0) {
        throw new Exception('El cuerpo de la solicitud no puede estar vacío', 400)
      }

      const resultado = await this.servicio.registrar(payload, documento, idRol)
      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionRegistrarLlegada')
      return manejarErrorIntegracion(error, response)
    }
  }

  public async obtenerSolicitud ({ request, params, response }: HttpContextContract) {
    try {
      await obtenerCredencialesJwt(request)
      const solicitud = await this.servicio.obtenerSolicitud(Number(params.id))
      return response.status(200).send(solicitud.serialize())
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionObtenerSolicitudLlegada')
      return manejarErrorIntegracion(error, response)
    }
  }

  public async listar ({ request, response }: HttpContextContract) {
    try {
      const { documento, idRol } = await obtenerCredencialesJwt(request)
      const { nit, page, numero_items: numeroItems } = request.qs()

      const resultado = await this.servicio.consultarLlegadas(
        documento,
        idRol,
        nit,
        page !== undefined ? Number(page) : undefined,
        numeroItems !== undefined ? Number(numeroItems) : undefined
      )

      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionConsultarLlegadas')
      return manejarErrorIntegracion(error, response)
    }
  }
}
