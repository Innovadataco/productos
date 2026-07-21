import Env from '@ioc:Adonis/Core/Env'
import { PayloadJWT } from 'App/Dominio/Dto/PayloadJWT'
import JwtExpiradoException from 'App/Exceptions/JwtExpiradoException'
import JwtInvalidoException from 'App/Exceptions/JwtInvalidoException'
import jwt, { SignOptions } from 'jsonwebtoken'

export class ServicioAutenticacionJWT {
  public static readonly tokenExpiraEnSegundos = 60 * 60 * 24
  public static readonly erroresJwt = {
    EXPIRADO: 'TokenExpiredError',
    INVALIDO: 'JsonWebTokenError',
  }

  public static generarToken (payload: PayloadJWT):string {
    const opciones: SignOptions = {
      expiresIn: this.tokenExpiraEnSegundos,
    }
    return jwt.sign(payload, Env.get('JWT_SECRET_KEY'), opciones)
  }

  public static verificarToken (authorizationHeader: string):boolean {
    let token = authorizationHeader.split(' ')[1]
    jwt.verify(token, Env.get('JWT_SECRET_KEY'), (error) => {
      if (error) {
        this.manejoExcepciones(error)
      }
    })
    return true
  }

  private static manejoExcepciones (error):void {
    if (error.name === this.erroresJwt.EXPIRADO) {
      throw new JwtExpiradoException(error.message)
    }
    if (error.name === this.erroresJwt.INVALIDO) {
      throw new JwtInvalidoException(error.message)
    }
  }

  public static obtenerPayload (token: string):PayloadJWT {
    const payload = jwt.verify(token, Env.get("JWT_SECRET_KEY"), {complete: true}).payload as PayloadJWT
     return payload
  }
}
