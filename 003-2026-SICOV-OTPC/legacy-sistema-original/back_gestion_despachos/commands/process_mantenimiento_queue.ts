import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import type { LoggerContract } from '@ioc:Adonis/Core/Logger'
import MantenimientoQueueService from 'App/Servicios/MantenimientoQueueService'

export default class ProcessMantenimientoQueue extends BaseCommand {
  public static commandName = 'mantenimiento:procesar-cola'

  public static description = 'Procesa los trabajos pendientes de sincronización con el servicio externo de mantenimiento'

  public static settings = {
    loadApp: true,
  }

  @flags.number({ alias: 'l', description: 'Cantidad máxima de trabajos a procesar en esta ejecución' })
  public limite: number = 25

  @flags.number({ alias: 'r', description: 'Número máximo de reintentos antes de marcar un trabajo como fallido' })
  public maxReintentos: number = 3

  public async run () {
    const limite = this.limite ?? 25
    const maxReintentos = this.maxReintentos ?? 3
    const service = new MantenimientoQueueService()
    const resultado = await service.procesarLote({
      limite,
      maxReintentos,
      logger: this.logger as unknown as LoggerContract,
    })

    if (resultado.procesados === 0 && resultado.reprogramados === 0 && resultado.fallidos === 0) {
      this.logger.info('No hay trabajos pendientes para procesar')
      return
    }

    this.logger.info(`Procesados: ${resultado.procesados}, reprogramados: ${resultado.reprogramados}, fallidos: ${resultado.fallidos}`)
  }
}
