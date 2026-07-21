import { Exception } from '@adonisjs/core/build/standalone'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class NoAprobado extends Exception {
    public async handle(error: this,ctx: HttpContextContract) {
        ctx.response.status(400).send({
            mensaje: `Faltan preguntas por responder o archivos por subir`,
            estado: 400
        })
    }
}