import { Controller, Get, Post, Body, UseGuards, Module } from '@nestjs/common'
import { IsNotEmpty, IsString } from 'class-validator'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { JwtGuard } from '../auth/jwt.guard'

class CrearUsuarioDto {
  @IsString() @IsNotEmpty() identificacion!: string
  @IsString() @IsNotEmpty() usuario!: string
  @IsString() @IsNotEmpty() nombre!: string
  @IsString() @IsNotEmpty() clave!: string
  @IsString() @IsNotEmpty() rol!: string
}

@UseGuards(JwtGuard)
@Controller('usuarios')
class UsuariosController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async listar() {
    const us = await this.prisma.usuario.findMany({ include: { rol: true }, orderBy: { creadoEn: 'asc' } })
    return us.map(({ clave, ...u }) => ({ ...u, rol: u.rol.nombre }))
  }

  @Get('roles')
  roles() {
    return this.prisma.rol.findMany()
  }

  @Post('registro')
  async crear(@Body() dto: CrearUsuarioDto) {
    const rol = await this.prisma.rol.findUnique({ where: { nombre: dto.rol } })
    const u = await this.prisma.usuario.create({
      data: {
        identificacion: dto.identificacion,
        usuario: dto.usuario,
        nombre: dto.nombre,
        clave: await bcrypt.hash(dto.clave, 10),
        rolId: rol!.id,
      },
    })
    const { clave, ...rest } = u
    return rest
  }
}

@Module({ controllers: [UsuariosController] })
export class UsuariosModule {}
