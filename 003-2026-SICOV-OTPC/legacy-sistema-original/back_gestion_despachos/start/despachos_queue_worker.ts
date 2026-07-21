import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import DespachosQueueService from 'App/Servicios/DespachosQueueService'

const globalReferencia = global as typeof global & { __DESPACHOS_WORKER_STARTED__?: boolean }

if (!globalReferencia.__DESPACHOS_WORKER_STARTED__) {
  globalReferencia.__DESPACHOS_WORKER_STARTED__ = true

  const autoStart = (Env.get('DESPACHOS_WORKER_AUTOSTART') ?? 'true').toString().toLowerCase() === 'true'
  const nodeEnv = (Env.get('NODE_ENV') ?? 'development').toString()
  const argv = process.argv.map((valor) => valor.toLowerCase())
  const indiceAce = argv.findIndex((valor) => valor.endsWith('ace'))
  const comandoAce = indiceAce >= 0 ? (argv[indiceAce + 1] || '') : ''
  const esAce = indiceAce >= 0
  const esServe = comandoAce === 'serve'

  if (autoStart && nodeEnv !== 'test' && (!esAce || (esAce && esServe))) {
    ;(async () => {
      const service = new DespachosQueueService()
      Logger.info('[DESPACHOS-QUEUE] Worker autostart habilitado')

      const sleep = async (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

      while (true) {
        try {
          const resultado = await service.procesarLote({ limite: 20, maxReintentos: 3, logger: Logger })
          if (resultado.procesados === 0 && resultado.reprogramados === 0 && resultado.fallidos === 0) {
            await sleep(1000)
          }
        } catch (error: any) {
          Logger.error('[DESPACHOS-QUEUE] Error en loop del worker: %s', error?.message || 'error desconocido')
          await sleep(2000)
        }
      }
    })()
  }
}
