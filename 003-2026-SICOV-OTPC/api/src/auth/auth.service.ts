import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { IntegracionesService } from '../integraciones/integraciones.service'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private integraciones: IntegracionesService,
  ) {}

  private firmar(u: { id: number; usuario: string; rol: { nombre: string }; rolId: number; nombre: string; empresaNit: string | null }) {
    const token = this.jwt.sign({ sub: u.id, usuario: u.usuario, rol: u.rol.nombre, rolId: u.rolId })
    return {
      token,
      usuario: { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol.nombre, rolId: u.rolId, empresa: u.empresaNit },
    }
  }

  async login(usuario: string, clave: string) {
    const u = await this.prisma.usuario.findFirst({
      where: { OR: [{ usuario }, { identificacion: usuario }] },
      include: { rol: true },
    })
    if (!u || !u.activo) throw new UnauthorizedException('Usuario o clave incorrectos.')
    const ok = await bcrypt.compare(clave, u.clave)
    if (!ok) throw new UnauthorizedException('Usuario o clave incorrectos.')
    return this.firmar(u)
  }

  // Login Vigía: valida el token externo (stub) y resuelve el usuario local por documento.
  async loginVigia(tokenVigia: string) {
    const datos = await this.integraciones.verificarTokenVigia(tokenVigia)
    if (!datos.valido) throw new UnauthorizedException('Token Vigía inválido.')
    let u = await this.prisma.usuario.findFirst({ where: { identificacion: datos.documento }, include: { rol: true } })
    if (!u) {
      const rolCliente = await this.prisma.rol.findUnique({ where: { nombre: 'cliente' } })
      u = await this.prisma.usuario.create({
        data: {
          identificacion: datos.documento,
          usuario: `vigia_${datos.documento}`,
          nombre: datos.nombre,
          clave: await bcrypt.hash(Math.random().toString(36), 8),
          rolId: rolCliente!.id,
          empresaNit: datos.documento,
        },
        include: { rol: true },
      })
    }
    return this.firmar(u)
  }
}
