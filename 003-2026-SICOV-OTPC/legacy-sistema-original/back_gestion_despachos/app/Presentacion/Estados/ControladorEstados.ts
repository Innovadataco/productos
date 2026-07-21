
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import TblEstadosEnviados from 'App/Infraestructura/Datos/Entidad/EstadosEnviados'


export default class ControladorEstados {


  public async enviadoSt ({ request, response }:HttpContextContract) {
    const { id } = await request.obtenerPayloadJWT()
    const enviado = await TblEstadosEnviados.query()
    .where('env_vigilado_id', id)
    .andWhere('env_estado',1).orderBy('env_id', 'desc')
    .first()
    if (enviado) {
      return response.ok({enviado: true})
    }
    return response.ok({enviado: false})

  }



}
