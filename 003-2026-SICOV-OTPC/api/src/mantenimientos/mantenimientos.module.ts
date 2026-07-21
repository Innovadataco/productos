import { Controller, Get, Post, Body, Query, UseGuards, Module } from '@nestjs/common'
import { IsNotEmpty, IsString } from 'class-validator'
import { PrismaService } from '../prisma/prisma.service'
import { JwtGuard } from '../auth/jwt.guard'

class CrearMantenimientoDto {
  @IsString() @IsNotEmpty() placa!: string
  @IsString() @IsNotEmpty() empresa!: string
  @IsString() @IsNotEmpty() tipo!: string
  @IsString() @IsNotEmpty() descripcion!: string
  @IsString() @IsNotEmpty() responsable!: string
}

@UseGuards(JwtGuard)
@Controller('mantenimiento')
class MantenimientosController {
  constructor(private prisma: PrismaService) {}

  @Get('historial')
  listar(@Query('tipo') tipo?: string) {
    return this.prisma.mantenimiento.findMany({
      where: tipo && tipo !== 'Todos' ? { tipo } : undefined,
      orderBy: { fecha: 'desc' },
    })
  }

  @Post('guardar')
  async crear(@Body() dto: CrearMantenimientoDto) {
    const n = await this.prisma.mantenimiento.count()
    return this.prisma.mantenimiento.create({ data: { ...dto, codigo: `MNT-${7700 + n}`, fecha: new Date(), estado: 'registrado' } })
  }

  // Carga masiva (stub): en producción parsea el XLSX con ExcelJS y valida columnas.
  @Post('carga-masiva')
  cargaMasiva(@Body() body: { registros?: CrearMantenimientoDto[] }) {
    return { recibidos: body.registros?.length ?? 0, encolados: body.registros?.length ?? 0 }
  }
}

@Module({ controllers: [MantenimientosController] })
export class MantenimientosModule {}
