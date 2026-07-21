/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { ServicioRol } from 'App/Dominio/Datos/Servicios/ServicioRol'
import { RepositorioRolDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioRolDB'

export default class ControladorRol {
  private service: ServicioRol
  constructor () {
    this.service = new ServicioRol(new RepositorioRolDB())
  }

  public async listar ({ request }) {
    const roles = await this.service.obtenerRols(request.all())
    return roles
  }

    public async listarModulos ({ request }) {
    const modulos = await this.service.obtenerModulos(request.all())
    return modulos
  }

 /*  public async obtenerRolPorId ({ params }) {
    const empresa = await this.service.obtenerRolPorId(params.id)
    return empresa
  }

  public async actualizarRol ({ params, request }) {
    const dataEmpresa = request.all()
    const empresa = await this.service.actualizarRol(params.id, dataEmpresa)
    return empresa
  } */

  /* public async guardarRol ({ request }) {
    const dataEmpresa = request.all()
    const empresa = await this.service.guardarRol(dataEmpresa)
    return empresa
  } */

/*   public async cambiarEstado ({request, response}:HttpContextContract){
    try{
      let id = request.param('id')
      await this.service.cambiarEstado(id)
      response.status(200).send('Cambio realizado correctamente')
    } catch (e) {
      response.status(200).send(e)
    }
  } */
}
