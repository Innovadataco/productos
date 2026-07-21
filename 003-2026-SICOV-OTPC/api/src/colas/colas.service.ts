import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IntegracionesService } from '../integraciones/integraciones.service'

const MAX_REINTENTOS = 3
const INTERVALO_MS = 60_000 // demo: 1 min. Producción: 5 min (300_000).

/**
 * Procesador de colas de despachos y llegadas.
 * Réplica del patrón actual (pendiente → procesando → procesado/fallido)
 * pero desacoplado. En producción se reemplaza por BullMQ + Redis sin tocar la API.
 */
@Injectable()
export class ColasService implements OnModuleInit {
  private readonly log = new Logger('Colas')

  constructor(private prisma: PrismaService, private integraciones: IntegracionesService) {}

  onModuleInit() {
    // Barrido periódico de la cola.
    setInterval(() => this.procesar().catch((e) => this.log.error(e)), INTERVALO_MS)
  }

  async procesar() {
    await this.procesarDespachos()
    await this.procesarLlegadas()
  }

  async procesarDespachos() {
    const pendientes = await this.prisma.despacho.findMany({
      where: { estado: { in: ['pendiente', 'fallido'] }, reintentos: { lt: MAX_REINTENTOS } },
      take: 25,
    })
    for (const d of pendientes) {
      await this.prisma.despacho.update({ where: { id: d.id }, data: { estado: 'procesando' } })
      const r = await this.integraciones.enviarDespacho({ placa: d.placa, nit: d.nit, ruta: d.ruta })
      if (r.ok) {
        await this.prisma.despacho.update({ where: { id: d.id }, data: { estado: 'procesado', respuesta: `OK · radicado ${r.radicado}` } })
      } else {
        const reintentos = d.reintentos + 1
        await this.prisma.despacho.update({ where: { id: d.id }, data: { estado: 'fallido', reintentos, respuesta: r.error } })
        await this.prisma.logError.create({ data: { origen: 'DespachosQueue', nivel: 'error', mensaje: `${d.codigo}: ${r.error} (reintento ${reintentos}/${MAX_REINTENTOS})` } })
      }
    }
    return pendientes.length
  }

  async procesarLlegadas() {
    const pendientes = await this.prisma.llegada.findMany({
      where: { estado: { in: ['pendiente', 'fallido'] }, reintentos: { lt: MAX_REINTENTOS } },
      take: 25,
    })
    for (const l of pendientes) {
      await this.prisma.llegada.update({ where: { id: l.id }, data: { estado: 'procesando' } })
      const r = await this.integraciones.enviarLlegada({ placa: l.placa, nit: l.nit, terminal: l.terminal })
      await this.prisma.llegada.update({
        where: { id: l.id },
        data: r.ok
          ? { estado: 'procesado', respuesta: `OK · radicado ${r.radicado}` }
          : { estado: 'fallido', reintentos: l.reintentos + 1, respuesta: r.error },
      })
    }
    return pendientes.length
  }

  // Reintento manual desde la UI.
  async reintentarDespacho(id: number) {
    await this.prisma.despacho.update({ where: { id }, data: { estado: 'pendiente' } })
    await this.procesarDespachos()
    return this.prisma.despacho.findUnique({ where: { id } })
  }
}
