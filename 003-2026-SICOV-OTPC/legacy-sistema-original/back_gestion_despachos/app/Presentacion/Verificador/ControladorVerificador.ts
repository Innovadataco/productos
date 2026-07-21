/* eslint-disable @typescript-eslint/naming-convention */

import { ServicioVerificador } from "App/Dominio/Datos/Servicios/ServicioVerificador"
import { RepositorioVerificadorDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioVerificadorDB"
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';

export default class ControladorVerificador {
  private service: ServicioVerificador
  constructor () {
    this.service = new ServicioVerificador(new RepositorioVerificadorDB())
  }
  async listar({request, response}:HttpContextContract){
    const { documento, idRol } = await request.obtenerPayloadJWT()
    try {
      const reportadas = await this.service.listar(documento, idRol)
      return response.status(200).send(reportadas)
    } catch (error) {
      throw error;
    }
  }
}
