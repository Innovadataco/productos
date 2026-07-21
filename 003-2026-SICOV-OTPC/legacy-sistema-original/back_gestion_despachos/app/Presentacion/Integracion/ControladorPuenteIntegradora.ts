/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { Exception } from '@adonisjs/core/build/standalone'
import { ServicioPuenteIntegradora } from 'App/Dominio/Datos/Servicios/ServicioPuenteIntegradora'
import { guardarLogError } from 'App/Dominio/guardarLogError'
import { obtenerCredencialesJwt, manejarErrorIntegracion } from 'App/Presentacion/Integracion/utilidadesIntegracion'

export default class ControladorPuenteIntegradora {
  private servicio = new ServicioPuenteIntegradora()

  public async resumen ({ request, response }: HttpContextContract) {
    try {
      const { documento, idRol } = await obtenerCredencialesJwt(request)
      const body = request.all()

      if (!body.numeroIdentificacion1 || !body.placa || !body.fechaConsulta) {
        throw new Exception(
          'Los campos numeroIdentificacion1, placa y fechaConsulta son obligatorios',
          400
        )
      }

      body.placa = String(body.placa).replace(/[\s-]/g, '').toUpperCase()

      const resultado = await this.servicio.consultarResumen(body, documento, idRol)
      return response.status(200).send(resultado)
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {}
      await guardarLogError(error, documento ?? '', 'integracionPuenteIntegradora')
      return manejarErrorIntegracion(error, response)
    }
  }
}
