import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { ServicioAutenticacion } from 'App/Dominio/Datos/Servicios/ServicioAutenticacion'
import { EnviadorEmailAdonis } from 'App/Infraestructura/Email/EnviadorEmailAdonis'
import { EncriptadorAdonis } from 'App/Infraestructura/Encriptacion/EncriptadorAdonis'
import { RepositorioAutorizacionDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioAutorizacionDB'
import { RepositorioBloqueoUsuarioDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioBloqueoUsuarioDB'
import { RepositorioUsuariosDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioUsuariosDB'
import axios from 'axios'
import Env from '@ioc:Adonis/Core/Env';

export default class ControladorArchivoVariable {
  private service: ServicioAutenticacion
  constructor () {
    this.service = new ServicioAutenticacion(
      new EncriptadorAdonis(),
      new EnviadorEmailAdonis(),
      new RepositorioBloqueoUsuarioDB(),
      new RepositorioAutorizacionDB(),
      new RepositorioUsuariosDB()
    )
  }

  public async inicioSesion ({ request }) {
    const peticion = request.all()
    const usuario = peticion['usuario']
    const contrasena = peticion['contrasena']
    const datos = await this.service.iniciarSesion(usuario, contrasena)
    return datos
  }

  public async inicioVigia ({ request, response }:HttpContextContract) {
    const peticion = request.all()
    const token = peticion['token']

    const respuesta = await axios.post(`${Env.get('URL_VIGIA')}/autenticacion/token/verificar`, {token}).then(resp =>{
      return resp.data      
    }).catch(err =>{
      if(err.response?.data){
        return err.response.data
      }else{
        return `Fallo el inicio de sesión - consulte con el administrador`

      }     
      
    })

    if( respuesta.datos){
      const datos = await this.service.iniciarSesion(respuesta.datos.documento, respuesta.datos.documento)
    return datos
    }

    return respuesta

  }

  public async cambiarClave({request, response}:HttpContextContract){
    const peticion = await request.body()
    const identificacion = peticion.identificacion
    const clave = peticion.clave
    const nuevaClave = peticion.nuevaClave

    await this.service.cambiarClave(identificacion, clave, nuevaClave)
    response.status(200).send({
      mensaje: 'Su contraseña ha sido cambiada exitosamente',
      estado: 200
    })
  }
}
