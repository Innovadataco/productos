import { Controller, Get, Post, Body, UseGuards, Module } from '@nestjs/common'
import { IsNotEmpty, IsString } from 'class-validator'
import { PrismaService } from '../prisma/prisma.service'
import { JwtGuard } from '../auth/jwt.guard'

class CrearLlegadaDto {
  @IsString() @IsNotEmpty() placa!: string
  @IsString() @IsNotEmpty() empresa!: string
  @IsString() @IsNotEmpty() nit!: string
  @IsString() @IsNotEmpty() tipoLlegada!: string
  @IsString() @IsNotEmpty() terminal!: string
}

@UseGuards(JwtGuard)
@Controller('llegadas')
class LlegadasController {
  constructor(private prisma: PrismaService) {}

  @Get()
  listar() {
    return this.prisma.llegada.findMany({ orderBy: { fechaHora: 'desc' } })
  }

  @Post()
  async crear(@Body() dto: CrearLlegadaDto) {
    const n = await this.prisma.llegada.count()
    return this.prisma.llegada.create({ data: { ...dto, codigo: `LLG-${19000 + n}`, fechaHora: new Date(), estado: 'pendiente' } })
  }
}

@Module({ controllers: [LlegadasController] })
export class LlegadasModule {}
