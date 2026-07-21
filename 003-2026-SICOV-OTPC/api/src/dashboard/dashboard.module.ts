import { Controller, Get, UseGuards, Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { JwtGuard } from '../auth/jwt.guard'

@UseGuards(JwtGuard)
@Controller('dashboard')
class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async resumen() {
    const [despachos, procesados, enCola, fallidos, llegadas, mantenimientos, novedades, vencidos] = await Promise.all([
      this.prisma.despacho.count(),
      this.prisma.despacho.count({ where: { estado: 'procesado' } }),
      this.prisma.despacho.count({ where: { estado: { in: ['pendiente', 'procesando'] } } }),
      this.prisma.despacho.count({ where: { estado: 'fallido' } }),
      this.prisma.llegada.count(),
      this.prisma.mantenimiento.count(),
      this.prisma.novedad.count(),
      this.prisma.novedad.count({ where: { severidad: 'vencido' } }),
    ])
    return {
      despachosHoy: despachos,
      despachosOk: procesados,
      enCola,
      despachosFallidos: fallidos,
      llegadasHoy: llegadas,
      mantenimientosMes: mantenimientos,
      novedadesActivas: novedades,
      vencidos,
      estadoCola: [
        { label: 'Procesado', value: procesados, color: 'var(--ok)' },
        { label: 'En cola', value: enCola, color: 'var(--info)' },
        { label: 'Fallido', value: fallidos, color: 'var(--danger)' },
      ],
    }
  }

  @Get('logs')
  logs() {
    return this.prisma.logError.findMany({ orderBy: { creadoEn: 'desc' }, take: 10 })
  }
}

@Module({ controllers: [DashboardController] })
export class DashboardModule {}
