import { Exception } from '@adonisjs/core/build/standalone'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class Errores extends Exception {
    public async handle(error: this,ctx: HttpContextContract) {
      
        ctx.response.status(error.status).send({
            mensaje: error.message,
            estado: error.status,
            acceso:false
        })
    }
}