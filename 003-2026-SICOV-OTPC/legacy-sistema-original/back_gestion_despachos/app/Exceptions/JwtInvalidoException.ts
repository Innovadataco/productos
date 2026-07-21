import { Exception } from '@adonisjs/core/build/standalone'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class JwtInvalidoException extends Exception {
    public async handle(error: this, ctx: HttpContextContract) {
        ctx.response.status(401).send({
            mensaje: `Token inválido`,
            estado: 401,
            origen: ctx.request.url(),
            token_valido: false,
            token_expirado: false
        })
    }
}
