import { Exception } from '@adonisjs/core/build/standalone'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class ErroresEmpresa extends Exception {
    public async handle(error: this,ctx: HttpContextContract) {
      
        ctx.response.status(error.status).send({
            mensaje: error.message,
            estado: error.status,
            acceso:false
        })
    }
}