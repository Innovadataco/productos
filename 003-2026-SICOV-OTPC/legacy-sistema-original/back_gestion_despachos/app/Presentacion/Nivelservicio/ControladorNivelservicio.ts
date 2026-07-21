/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { ServicioNivelservicio } from 'App/Dominio/Datos/Servicios/ServicioNivelservicio'
import { RepositorioNivelservicioDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioNivelservicioDB'
import ListarValidator from 'App/Presentacion/Nivelservicio/Validadores/listar'
import CustomException from "App/Exceptions/CustomException";
import { ValidationException } from '@ioc:Adonis/Core/Validator'
import { guardarLogError } from 'App/Dominio/guardarLogError';
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario';
import { Exception } from "@adonisjs/core/build/standalone";

export default class ControladorNivelservicio {
  private service: ServicioNivelservicio

  constructor () {
    this.service = new ServicioNivelservicio(new RepositorioNivelservicioDB())
  }

  private manejarError(error: any, response: any): any {
    if(error.responseData) {
      return response.status(error.status || 500).send(error.responseData)
    }
    if(error.status === 401 || error.message?.includes('Su sesión ha expirado')) {
      return response.status(401).send({ mensaje: error.message || 'Su sesión ha expirado. Por favor, vuelva a iniciar sesión' })
    }
    if(error.status === 400 || error.message?.includes('Token de autorización no encontrado')) {
      return response.status(400).send({ mensaje: error.message || 'Datos de autorización inválidos' })
    }
    if(error.status === 404 || error.message?.includes('no encontrado') || error.message?.includes('No se encontró')) {
      return response.status(404).send({ mensaje: error.message || 'Recurso no encontrado' })
    }
    return response.status(500).send({ mensaje: 'Error interno del servidor' })
  }

  public async Listar({ request, response }: HttpContextContract)
  {
    try
    {
      const obj_request = await request.validate(ListarValidator);

      const payload = await request.obtenerPayloadJWT();
      const documento = payload?.documento || '';
      let token = '';

      const usuarioDb = await TblUsuarios.query().where('identificacion', documento).first();
      if (usuarioDb) {
        token = usuarioDb.tokenAutorizado || '';
      }

      const resultado = await this.service.Listar(obj_request, token, documento);

      return response.status(200).send(resultado);
    }
    catch (error)
    {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'listarNivelServicio');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      return CustomException.error(
        response,
        500,
        "Error al listar niveles de servicio",
        [error.message || 'Error desconocido']
      );
    }
  }
}
