import { Controller, Get, Post, Body, Query, Param, UseGuards, Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { IntegracionesService } from '../integraciones/integraciones.service'
import { IntegracionesModule } from '../integraciones/integraciones.module'
import { JwtGuard } from '../auth/jwt.guard'

@UseGuards(JwtGuard)
@Controller('novedades')
class NovedadesController {
  constructor(private prisma: PrismaService) {}
  @Get()
  listar(@Query('categoria') categoria?: string) {
    return this.prisma.novedad.findMany({ where: categoria && categoria !== 'Todas' ? { categoria } : undefined })
  }
}

@UseGuards(JwtGuard)
@Controller('soportes')
class SoportesController {
  constructor(private prisma: PrismaService) {}
  @Get()
  listar() {
    return this.prisma.soporte.findMany({ orderBy: { creadoEn: 'desc' } })
  }
  @Post()
  async crear(@Body() b: { asunto: string; motivo: string; empresa: string }) {
    const n = await this.prisma.soporte.count()
    return this.prisma.soporte.create({ data: { ...b, codigo: `SOP-${3300 + n}`, estado: 'abierto', adjuntos: 0 } })
  }
}

@UseGuards(JwtGuard)
@Controller('empresas')
class EmpresasController {
  constructor(private prisma: PrismaService) {}
  @Get()
  listar() {
    return this.prisma.empresa.findMany({ orderBy: { nombre: 'asc' } })
  }
}

@UseGuards(JwtGuard)
@Controller('terminales')
class TerminalesController {
  constructor(private prisma: PrismaService) {}
  @Get('rutas')
  rutas() {
    return this.prisma.ruta.findMany({ orderBy: { codigo: 'asc' } })
  }
}

@UseGuards(JwtGuard)
@Controller('integracion/integradora')
class IntegradoraController {
  constructor(private integraciones: IntegracionesService) {}
  @Get('resumen/:placa')
  resumen(@Param('placa') placa: string) {
    return this.integraciones.resumenIntegradora(placa)
  }
}

@Module({
  imports: [IntegracionesModule],
  controllers: [NovedadesController, SoportesController, EmpresasController, TerminalesController, IntegradoraController],
})
export class CatalogosModule {}
