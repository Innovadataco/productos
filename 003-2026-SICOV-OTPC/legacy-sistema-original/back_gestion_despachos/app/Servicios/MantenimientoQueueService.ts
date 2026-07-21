import { DateTime } from 'luxon'
import { LoggerContract } from '@ioc:Adonis/Core/Logger'
import TblMantenimientoJob from 'App/Infraestructura/Datos/Entidad/MantenimientoJob'
import { MantenimientoPendienteError, RepositorioMantenimientoDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioMantenimientoDB'

export interface ProcesarColaOpciones {
  limite: number
  maxReintentos: number
  logger: LoggerContract
}

export interface ResultadoProcesamiento {
  procesados: number
  reprogramados: number
  fallidos: number
}

export default class MantenimientoQueueService {
  private repositorio = new RepositorioMantenimientoDB()
  private extraerMensajeError (error: any): string {
    const candidatos = [
      error?.mensajeApi,
      error?.mensajeInterno,
      error?.responseData,
      error?.response?.data,
      error?.response?.body,
      error?.original?.response?.data
    ]

    for (const datos of candidatos) {
      if (!datos) {
        continue
      }

      if (typeof datos === 'string' && datos.trim() !== '') {
        return datos.trim()
      }

      if (typeof datos === 'object') {
        const posiblesClaves = [
          'mensaje',
          'message',
          'detail',
          'error',
          'errorMessage',
          'descripcion'
        ]

        for (const clave of posiblesClaves) {
          const valor = (datos as Record<string, any>)[clave]
          if (typeof valor === 'string' && valor.trim() !== '') {
            return valor.trim()
          }
        }

        try {
          const serializado = JSON.stringify(datos)
          if (serializado.trim() !== '') {
            return serializado.length > 300 ? `${serializado.slice(0, 297)}...` : serializado
          }
        } catch {
          // Ignorar error de serialización y continuar con la siguiente fuente
        }
      }
    }

    const mensaje = error?.message
    if (typeof mensaje === 'string' && mensaje.trim() !== '') {
      return mensaje.trim()
    }

    const descripcion = typeof error === 'string' ? error : error?.toString?.()
    if (typeof descripcion === 'string' && descripcion.trim() !== '') {
      return descripcion.trim()
    }

    return 'Error desconocido'
  }

  public async procesarLote (opciones: ProcesarColaOpciones): Promise<ResultadoProcesamiento> {
    const ahora = DateTime.now()
    const trabajos = await TblMantenimientoJob.query()
      .where('tmj_estado', 'pendiente')
      .where('tmj_siguiente_intento', '<=', ahora.toJSDate())
      .orderBy('tmj_id', 'asc')
      .limit(opciones.limite)

    if (trabajos.length === 0) {
      return { procesados: 0, reprogramados: 0, fallidos: 0 }
    }

    let procesados = 0
    let reprogramados = 0
    let fallidos = 0

    for (const job of trabajos) {
      try {
        job.estado = 'procesando'
        await job.save()

        await this.repositorio.procesarJob(job)

        job.estado = 'procesado'
        job.ultimoError = null
        job.siguienteIntento = DateTime.now()
        await job.save()

        procesados += 1
        opciones.logger.info(`Trabajo ${job.id} procesado correctamente (${job.tipo})`)
      } catch (error: any) {
        const mensajeError = this.extraerMensajeError(error)
        const mensajePrioritario = typeof error?.mensajeApi === 'string' && error.mensajeApi.trim() !== ''
          ? error.mensajeApi.trim()
          : mensajeError

        if (error instanceof MantenimientoPendienteError) {
          job.ultimoError = mensajePrioritario
          job.estado = 'pendiente'
          job.siguienteIntento = DateTime.now().plus({ minutes: 5 })
          await job.save()
          reprogramados += 1
          opciones.logger.info(`Trabajo ${job.id} reprogramado a la espera del mantenimiento base. Motivo: ${mensajePrioritario}`)
          continue
        }

        const registrarFallo = async (mensaje: string, esFalloDefinitivo: boolean) => {
          job.ultimoError = mensaje
          if (esFalloDefinitivo) {
            job.estado = 'fallido'
            job.siguienteIntento = DateTime.now()
            await job.save()
            fallidos += 1
            opciones.logger.error(`Trabajo ${job.id} marcado como fallido tras ${job.reintentos} intentos. Error: ${mensaje}`)
          } else {
            job.estado = 'pendiente'
            job.siguienteIntento = DateTime.now().plus({ minutes: 5 })
            await job.save()
            reprogramados += 1
            opciones.logger.info(`Trabajo ${job.id} reprogramado para 5 minutos. Intento ${job.reintentos}/${opciones.maxReintentos}. Motivo: ${mensaje}`)
          }
        }

        const incrementarReintento = () => {
          job.reintentos = (job.reintentos ?? 0) + 1
          return job.reintentos >= opciones.maxReintentos
        }

        const esLimite = incrementarReintento()
        await registrarFallo(mensajePrioritario, esLimite)
      }
    }

    return { procesados, reprogramados, fallidos }
  }
}
