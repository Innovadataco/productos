import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe, Module } from '@nestjs/common'
import { IsNotEmpty, IsString } from 'class-validator'
import { PrismaService } from '../prisma/prisma.service'
import { ColasService } from '../colas/colas.service'
import { ColasModule } from '../colas/colas.module'
import { JwtGuard } from '../auth/jwt.guard'

class CrearDespachoDto {
  @IsString() @IsNotEmpty() placa!: string
  @IsString() @IsNotEmpty() empresa!: string
  @IsString() @IsNotEmpty() nit!: string
  @IsString() @IsNotEmpty() ruta!: string
  @IsString() @IsNotEmpty() origen!: string
  @IsString() @IsNotEmpty() destino!: string
}

@UseGuards(JwtGuard)
@Controller('despachos')
class DespachosController {
  constructor(private prisma: PrismaService, private colas: ColasService) {}

  @Get()
  listar() {
    return this.prisma.despacho.findMany({ orderBy: { fechaHora: 'desc' } })
  }

  @Get('placa/:placa')
  porPlaca(@Param('placa') placa: string) {
    return this.prisma.despacho.findMany({ where: { placa } })
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.despacho.findUnique({ where: { id } })
  }

  @Post()
  async crear(@Body() dto: CrearDespachoDto) {
    const n = await this.prisma.despacho.count()
    return this.prisma.despacho.create({
      data: { ...dto, codigo: `DSP-${25000 + n}`, fechaHora: new Date(), estado: 'pendiente' },
    })
  }

  @Post(':id/reintentar')
  reintentar(@Param('id', ParseIntPipe) id: number) {
    return this.colas.reintentarDespacho(id)
  }
}

@Module({ imports: [ColasModule], controllers: [DespachosController] })
export class DespachosModule {}
