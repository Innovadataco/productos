import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { IocContract } from '@adonisjs/fold'
import { RepositorioFicheroLocal } from 'App/Infraestructura/Ficheros/RepositorioFicheroLocal'
import AutenticacionJWT from 'App/Middlewares/AuntenticacionJWT'
import { ServicioAutenticacionJWT } from 'App/Dominio/Datos/Servicios/ServicioJWT'

export default class AppProvider {
  constructor (protected app: ApplicationContract, protected $container: IocContract) {
  }

  public register () {
    this.app.container.bind('App/Dominio/Ficheros/RepositorioFichero', ()=>{
      return new RepositorioFicheroLocal()
    })
  }

  public async boot () {
    // IoC container is ready
    const Request = this.app.container.use('Adonis/Core/Request')

    Request.macro('obtenerPayloadJWT', async function () {
      const authorization = this.header('Authorization')
      const jwt = authorization!.split(' ')[1]
      const payload = await ServicioAutenticacionJWT.obtenerPayload(jwt)
      return payload
    })
  }

  public async ready () {
    // App is ready
  }

  public async shutdown () {
    // Cleanup, since app is going down
  }
}
