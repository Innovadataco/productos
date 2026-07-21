/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { Exception } from '@adonisjs/core/build/standalone'
import { ServicioPuenteMaestras } from 'App/Dominio/Datos/Servicios/ServicioPuenteMaestras'
import { guardarLogError } from 'App/Dominio/guardarLogError'
import { obtenerCredencialesJwt, manejarErrorIntegracion } from 'App/Presentacion/Integracion/utilidadesIntegracion'

export default class ControladorPuenteMaestras {
  private servicio = new ServicioPuenteMaestras()

  public async nivelServicio ({ request, response }: HttpContextContract) {
    try {
      const { documento, idRol } = await obtenerCredencialesJwt(request)
      const { page, numero_items: numeroItems } = request.all()

      const resultado = await this.servicio.listarNivelServicio(
        documento,
        idRol,
        page !== undefined ? Number(page) : undefined,
        numeroItems !== undefined ? Number(numeroItems) : undefined
      )

      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionPuenteNivelServicio')
      return manejarErrorIntegracion(error, response)
    }
  }

  public async tipoIdentificaciones ({ request, response }: HttpContextContract) {
    try {
      await obtenerCredencialesJwt(request)
      const resultado = await this.servicio.listarTipoIdentificaciones()
      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionPuenteTipoIdentificaciones')
      return manejarErrorIntegracion(error, response)
    }
  }

  public async claseVehiculo ({ request, response }: HttpContextContract) {
    try {
      await obtenerCredencialesJwt(request)
      const resultado = await this.servicio.listarClaseVehiculo()
      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionPuenteClaseVehiculo')
      return manejarErrorIntegracion(error, response)
    }
  }

  public async centrosPoblados ({ request, response }: HttpContextContract) {
    try {
      await obtenerCredencialesJwt(request)
      const resultado = await this.servicio.listarCentrosPoblados()
      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionPuenteCentrosPoblados')
      return manejarErrorIntegracion(error, response)
    }
  }

  public async rutasActivasEmpresa ({ request, response }: HttpContextContract) {
    try {
      const { documento, idRol } = await obtenerCredencialesJwt(request)
      const { nit } = request.all()

      if (!nit) {
        throw new Exception('El parámetro nit es obligatorio', 400)
      }

      const resultado = await this.servicio.listarRutasActivasEmpresa(nit, documento, idRol)
      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionPuenteRutasActivas')
      return manejarErrorIntegracion(error, response)
    }
  }

  public async autorizaciones ({ request, response }: HttpContextContract) {
    try {
      await obtenerCredencialesJwt(request)
      const { nit, placa, fecha } = request.all()

      if (!nit || !placa || !fecha) {
        throw new Exception('Los parámetros nit, placa y fecha son obligatorios', 400)
      }

      const resultado = await this.servicio.listarAutorizaciones(
        nit,
        placa,
        fecha
      )

      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionPuenteAutorizaciones')
      return manejarErrorIntegracion(error, response)
    }
  }
}
