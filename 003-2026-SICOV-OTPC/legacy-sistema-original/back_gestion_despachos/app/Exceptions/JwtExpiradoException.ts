import { Exception } from '@adonisjs/core/build/standalone'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class JwtExpiradoException extends Exception {
    public async handle(error: this,ctx: HttpContextContract) {
        ctx.response.status(400).send({
            mensaje: `Token Expirado`,
            estado: 400,
            origen: ctx.request.url(),
            token_valido: false,
            token_expirado: true
        })
    }
}
