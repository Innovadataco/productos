/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { ServicioEmail } from 'App/Dominio/Datos/Servicios/ServicioEmail'
import { ServicioUsuarios } from 'App/Dominio/Datos/Servicios/ServicioUsuarios'
import { GeneradorContrasena } from 'App/Dominio/GenerarContrasena/GenerarContrasena'
import { EnviadorEmailAdonis } from 'App/Infraestructura/Email/EnviadorEmailAdonis'
import { EncriptadorAdonis } from 'App/Infraestructura/Encriptacion/EncriptadorAdonis'
import { RepositorioUsuariosDB } from '../../Infraestructura/Implementacion/Lucid/RepositorioUsuariosDB'
import { RepositorioBloqueoUsuarioDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioBloqueoUsuarioDB'

export default class ControladorEmail {
  private service: ServicioEmail
  constructor () {
    this.service = new ServicioEmail (
      new EnviadorEmailAdonis(), 
      new GeneradorContrasena(), 
      new ServicioUsuarios(
        new RepositorioUsuariosDB(),
        new GeneradorContrasena(), 
        new EncriptadorAdonis(),
        new EnviadorEmailAdonis()
      ),
      new RepositorioBloqueoUsuarioDB()
    )
  }

  public async EnviarEmail ({request, response}:HttpContextContract) {
      const peticion = request.all()
      let usuario = peticion['usuario']
      let correo = peticion['correo']
      await this.service.ComprobarUsuario(usuario, correo)
      response.status(200).send({mensaje: 'Mensaje enviado correctamente'})
   
  }
}

