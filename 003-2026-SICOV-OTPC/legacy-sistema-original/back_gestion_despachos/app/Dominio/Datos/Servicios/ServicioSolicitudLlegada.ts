import { Exception } from '@adonisjs/core/build/standalone'
import Env from '@ioc:Adonis/Core/Env'
import { ClienteApiSupertransporte } from 'App/Dominio/Utilidades/ClienteApiSupertransporte'
import TblSolicitudLlegada from 'App/Infraestructura/Datos/Entidad/SolicitudLlegada'
import { obtenerDatosAutenticacionUsuario } from 'App/Infraestructura/Implementacion/Lucid/AutenticacionUsuarioHelper'

export class ServicioSolicitudLlegada {
  private validarPayload (payload: Record<string, unknown>): Record<string, unknown> {
    const idTipoLlegada = Number(payload.idTipollegada ?? payload.idTipoLlegada)

    if (![1, 2].includes(idTipoLlegada)) {
      throw new Exception('El campo idTipollegada debe ser 1 (con despacho) o 2 (sin despacho)', 400)
    }

    if (payload.placa === undefined || payload.placa === null || payload.placa === '') {
      throw new Exception('El campo placa es obligatorio', 400)
    }

    const placa = ClienteApiSupertransporte.limpiarPlaca(String(payload.placa))

    if (payload.numeroPasajero === undefined || payload.numeroPasajero === null) {
      throw new Exception('El campo numeroPasajero es obligatorio', 400)
    }

    const numeroPasajero = 0

   /*  const numeroPasajero = Number(payload.numeroPasajero)
    if (!Number.isFinite(numeroPasajero) || numeroPasajero < 0) {
      throw new Exception('El campo numeroPasajero debe ser un número mayor o igual a 0', 400)
    } */

    const idDespacho = payload.idDespacho !== undefined && payload.idDespacho !== null
      ? Number(payload.idDespacho)
      : null

    if (idTipoLlegada === 1) {
      if (!idDespacho || !Number.isFinite(idDespacho) || idDespacho <= 0) {
        throw new Exception('El campo idDespacho es obligatorio para llegadas tipo 1', 400)
      }
    } else if (payload.idDespacho !== undefined && payload.idDespacho !== null) {
      throw new Exception('El campo idDespacho debe ser null para llegadas tipo 2', 400)
    }

    return {
      ...payload,
      idTipollegada: idTipoLlegada,
      placa,
      numeroPasajero,
      idDespacho: idTipoLlegada === 1 ? idDespacho : null,
    }
  }

  public async registrar (
    payload: Record<string, unknown>,
    identificacion: string,
    idRol: number
  ): Promise<any> {
    const payloadNormalizado = this.validarPayload(payload)
    const { nitVigilado } = await obtenerDatosAutenticacionUsuario(identificacion, idRol)
    const tipoLlegada = Number(payloadNormalizado.idTipollegada)

    const solicitud = await TblSolicitudLlegada.create({
      payload: payloadNormalizado,
      nitVigilado,
      usuarioId: identificacion,
      fuenteDato: 'WEB',
      tipoLlegada,
      idDespacho: tipoLlegada === 1 ? Number(payloadNormalizado.idDespacho) : null,
      placa: String(payloadNormalizado.placa),
      procesado: false,
      idLlegadaExterno: null,
      respuestaExterna: null,
      errorExterno: null,
    })

    const url = `${Env.get('URL_DESPACHOS')}/llegadasempresas`

    try {
      const respuestaExterna = await ClienteApiSupertransporte.postTransaccional(
        url,
        payloadNormalizado,
        identificacion,
        idRol
      )

      const idLlegadaExterno = ClienteApiSupertransporte.extraerIdLlegadaExterno(respuestaExterna)

      solicitud.merge({
        procesado: true,
        idLlegadaExterno,
        respuestaExterna,
        errorExterno: null,
      })
      await solicitud.save()

      return {
        solicitudId: solicitud.id,
        idLlegadaExterno,
        ...respuestaExterna,
      }
    } catch (error: any) {
      solicitud.merge({
        errorExterno: JSON.stringify(error?.responseData || error?.message || 'Error desconocido'),
      })
      await solicitud.save()
      throw error
    }
  }

  public async obtenerSolicitud (id: number): Promise<TblSolicitudLlegada> {
    return TblSolicitudLlegada.findOrFail(id)
  }

  public async consultarLlegadas (
    identificacion: string,
    idRol: number,
    nit?: string,
    page?: number,
    numeroItems?: number
  ): Promise<any> {
    const url = `${Env.get('URL_DESPACHOS')}/llegada`

    const params: Record<string, unknown> = {}
    const nitLimpio = typeof nit === 'string' ? nit.trim() : ''
    if (nitLimpio !== '') params.nit = nitLimpio
    if (page !== undefined) params.page = page
    if (numeroItems !== undefined) params.numero_items = numeroItems

    return ClienteApiSupertransporte.getTransaccional(url, identificacion, idRol, params)
  }
}
