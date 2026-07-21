/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { Exception } from '@adonisjs/core/build/standalone'
import { ServicioSolicitudDespacho } from 'App/Dominio/Datos/Servicios/ServicioSolicitudDespacho'
import { guardarLogError } from 'App/Dominio/guardarLogError'
import { obtenerCredencialesJwt, manejarErrorIntegracion } from 'App/Presentacion/Integracion/utilidadesIntegracion'

export default class ControladorIntegracionDespachos {
  private servicio = new ServicioSolicitudDespacho()

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
      await guardarLogError(error, documento ?? '', 'integracionRegistrarDespacho')

      if (error instanceof Exception) {
        return manejarErrorIntegracion(error, response)
      }

      return manejarErrorIntegracion(error, response)
    }
  }

  public async listarSolicitudes ({ request, response }: HttpContextContract) {
    try {
      await obtenerCredencialesJwt(request)
      const { estado } = request.qs()
      const solicitudes = await this.servicio.listarSolicitudes(estado)
      return response.status(200).send(solicitudes.map((solicitud) => solicitud.serialize()))
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionListarSolicitudesDespacho')
      return manejarErrorIntegracion(error, response)
    }
  }

  public async reintentarSolicitud ({ request, params, response }: HttpContextContract) {
    try {
      await obtenerCredencialesJwt(request)
      const solicitud = await this.servicio.reintentarSolicitud(Number(params.id))
      return response.status(200).send(solicitud.serialize())
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionReintentarSolicitudDespacho')
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
      await guardarLogError(error, documento ?? '', 'integracionObtenerSolicitudDespacho')
      return manejarErrorIntegracion(error, response)
    }
  }

  public async consultarPorNit ({ request, response }: HttpContextContract) {
    try {
      const { documento, idRol } = await obtenerCredencialesJwt(request)
      const { nit } = request.qs()
      const resultado = await this.servicio.consultarPorNit(nit, documento, idRol)

      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionConsultarDespachoNit')
      return manejarErrorIntegracion(error, response)
    }
  }

  public async consultarPorPlaca ({ request, params, response }: HttpContextContract) {
    try {
      const { documento, idRol } = await obtenerCredencialesJwt(request)
      const { fechaSalida } = request.all()
      const resultado = await this.servicio.consultarPorPlaca(
        params.placa,
        documento,
        idRol,
        fechaSalida
      )

      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionConsultarDespachoPlaca')
      return manejarErrorIntegracion(error, response)
    }
  }

  public async consultarPorId ({ request, params, response }: HttpContextContract) {
    try {
      const { documento, idRol } = await obtenerCredencialesJwt(request)
      const resultado = await this.servicio.consultarPorId(
        Number(params.id),
        documento,
        idRol
      )

      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionConsultarDespachoId')
      return manejarErrorIntegracion(error, response)
    }
  }
}
