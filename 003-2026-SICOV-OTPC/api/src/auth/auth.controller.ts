import { Body, Controller, Post } from '@nestjs/common'
import { IsNotEmpty, IsString } from 'class-validator'
import { AuthService } from './auth.service'

class LoginDto {
  @IsString() @IsNotEmpty() usuario!: string
  @IsString() @IsNotEmpty() clave!: string
}
class VigiaDto {
  @IsString() @IsNotEmpty() token!: string
}

@Controller('autenticacion')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('inicio-sesion')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.usuario, dto.clave)
  }

  @Post('inicio-vigia')
  vigia(@Body() dto: VigiaDto) {
    return this.auth.loginVigia(dto.token)
  }
}
