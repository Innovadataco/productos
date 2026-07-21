import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env';
import JwtInvalidoException from 'App/Exceptions/JwtInvalidoException';
export default class Autorization {
  public async handle({request, response}: HttpContextContract, next: () => Promise<void>) {
    const header = request.header('Authorization')
    if(!header){
      throw new JwtInvalidoException('Falta el token de autenticación')
    }
    let token = header.split(' ')[1]
    if (token !== Env.get('TOKEN')){
      response.status(401).send({
        mensaje: 'No tiene permisos para acceder a este api',
        error: 1
      })
    }
    await next()
  }
}
