import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import axios from 'axios'
import Env from '@ioc:Adonis/Core/Env';

export default class AutenticacionVigia {
  public async handle({request, response}: HttpContextContract, next: () => Promise<void>) {
    const cabeceraAutenticacion = request.header('Authorization')
    if(!cabeceraAutenticacion){
      throw new Error("Falta el token de autenticación");
    }
    let token = cabeceraAutenticacion.split(' ')[1]
    const respuesta = await axios.post(`${Env.get('URL_VIGIA')}/autenticacion/token/verificar`, {token}).then(resp =>{
      return resp.data
    }).catch(err =>{
      if(err.response?.data){
        return err.response.data
      }else{
        return `Fallo el inicio de sesión - consulte con el administrador`

      }

    })
    if(respuesta && respuesta.estado == 200){
      request.respuestaDatos = respuesta.datos; // Add datos to request object
      await next(); // Call next without parameters
    }else{
      throw new Error("Error en el token");
    }

  }
}
