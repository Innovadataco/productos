import { DateTime } from 'luxon'
import { LoggerContract } from '@ioc:Adonis/Core/Logger'
import Env from '@ioc:Adonis/Core/Env'
import TblSolicitudDespacho from 'App/Infraestructura/Datos/Entidad/SolicitudDespacho'
import { ClienteApiSupertransporte } from 'App/Dominio/Utilidades/ClienteApiSupertransporte'

export interface ProcesarColaDespachosOpciones {
  limite: number
  maxReintentos: number
  logger: LoggerContract
}

export interface ResultadoProcesamientoDespachos {
  procesados: number
  reprogramados: number
  fallidos: number
}

export default class DespachosQueueService {
  private extraerMensajeError (error: any): string {
    const candidatos = [
      error?.responseData,
      error?.response?.data,
      error?.message,
    ]

    for (const datos of candidatos) {
      if (!datos) {
        continue
      }

      if (typeof datos === 'string' && datos.trim() !== '') {
        return datos.trim()
      }

      if (typeof datos === 'object') {
        const valor = datos.mensaje || datos.message || datos.error
        if (typeof valor === 'string' && valor.trim() !== '') {
          return valor.trim()
        }

        try {
          const serializado = JSON.stringify(datos)
          if (serializado.trim() !== '') {
            return serializado.length > 300 ? `${serializado.slice(0, 297)}...` : serializado
          }
        } catch {
          // Ignorar error de serialización
        }
      }
    }

    return 'Error desconocido'
  }

  /**
   * Envía la solicitud al API externo de despachos y actualiza la entidad
   * con el resultado. No persiste: deja el `save` al llamador.
   */
  public async enviarSolicitud (solicitud: TblSolicitudDespacho): Promise<void> {
    const urlDespachos = Env.get('URL_DESPACHOS')
    const url = `${urlDespachos}/despachosempresa`


    const respuestaExterna = await ClienteApiSupertransporte.postTransaccional(
      url,
      solicitud.payload,
      solicitud.usuarioId,
      Number(solicitud.rolId)
    )

    const idDespachoExterno = ClienteApiSupertransporte.extraerIdDespachoExterno(respuestaExterna)

    solicitud.merge({
      procesado: true,
      idDespachoExterno,
      respuestaExterna,
      errorExterno: null,
    })
  }

  public async procesarLote (
    opciones: ProcesarColaDespachosOpciones
  ): Promise<ResultadoProcesamientoDespachos> {
    const ahora = DateTime.now()
    const solicitudes = await TblSolicitudDespacho.query()
      .where('des_sol_estado', 'pendiente')
      .where('des_sol_procesado', false)
      .where('des_sol_siguiente_intento', '<=', ahora.toJSDate())
      .orderBy('des_sol_id', 'asc')
      .limit(opciones.limite)

    if (solicitudes.length === 0) {
      return { procesados: 0, reprogramados: 0, fallidos: 0 }
    }

    let procesados = 0
    let reprogramados = 0
    let fallidos = 0

    for (const solicitud of solicitudes) {
      try {
        solicitud.estado = 'procesando'
        await solicitud.save()

        await this.enviarSolicitud(solicitud)

        solicitud.estado = 'procesado'
        solicitud.siguienteIntento = DateTime.now()
        await solicitud.save()

        procesados += 1
        opciones.logger.info(`Solicitud de despacho ${solicitud.id} procesada correctamente`)
      } catch (error: any) {
        const mensaje = this.extraerMensajeError(error)
        const statusCode = Number(error?.status) || 500
        opciones.logger.error(
          'Error API externo POST /despachosempresa (solicitud %s): status=%s respuesta=%s',
          solicitud.id,
          statusCode,
          JSON.stringify(error?.responseData ?? error?.message ?? 'sin detalle')
        )
        solicitud.errorExterno = mensaje
        solicitud.reintentos = (solicitud.reintentos ?? 0) + 1

        if (solicitud.reintentos >= opciones.maxReintentos) {
          solicitud.estado = 'fallido'
          solicitud.siguienteIntento = DateTime.now()
          await solicitud.save()
          fallidos += 1
          opciones.logger.error(`Solicitud de despacho ${solicitud.id} marcada como fallida tras ${solicitud.reintentos} intentos. Error: ${mensaje}`)
        } else {
          solicitud.estado = 'pendiente'
          solicitud.siguienteIntento = DateTime.now().plus({ minutes: 5 })
          await solicitud.save()
          reprogramados += 1
          opciones.logger.info(`Solicitud de despacho ${solicitud.id} reprogramada para 5 minutos. Intento ${solicitud.reintentos}/${opciones.maxReintentos}. Motivo: ${mensaje}`)
        }
      }
    }

    return { procesados, reprogramados, fallidos }
  }
}
