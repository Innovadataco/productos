/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { ServicioNovedades } from "App/Dominio/Datos/Servicios/ServicioNovedades";
import { RepositorioNovedadesDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioNovedadesDB";
import CrearNovedadValidator from 'App/Presentacion/Novedades/Validadores/crearNovedad'
import EditarNovedadValidator from 'App/Presentacion/Novedades/Validadores/editarNovedad'
import ListarNovedadValidator from 'App/Presentacion/Novedades/Validadores/listarNovedad'
import IdValidator from 'App/Presentacion/Novedades/Validadores/IdValidator'
import CustomException from "App/Exceptions/CustomException";
import { ValidationException } from '@ioc:Adonis/Core/Validator'
import { guardarLogError } from 'App/Dominio/guardarLogError';
import { Exception } from "@adonisjs/core/build/standalone";

export default class ControladorNovedades {
  private servicioNovedades = new ServicioNovedades(new RepositorioNovedadesDB());

  /**
   * Maneja los errores de forma consistente
   */
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
    if(error.status === 404 || error.message?.includes('no encontrado')) {
      return response.status(404).send({ mensaje: error.message || 'Recurso no encontrado' })
    }
    return response.status(500).send({ mensaje: 'Error interno del servidor' })
  }

  public async Listar({ request, response }: HttpContextContract) {
    try {

      const obj_request = await request.validate(ListarNovedadValidator);

      return CustomException.success(
          response,
          200,
          'Listado de novedades',
          ['Listado generado exitosamente'],
          await this.servicioNovedades.Listar(obj_request)
      )

    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'listarNovedades');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      if (error instanceof ValidationException) {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []
        return CustomException.error(response, 422, "Campos invalidos", messages);
      }

      return CustomException.error(response, 500, "Error al listar la novedad", [error.message || 'Error desconocido']);
    }
  }

  public async Crear({ request, response }: HttpContextContract) {
    try {
      const data = request.all();

      const payloadJWT = await request.obtenerPayloadJWT();
      const documento = payloadJWT?.documento || '';
      const idRol = payloadJWT?.idRol;

      if (!documento || typeof idRol !== 'number') {
        throw new Exception('Datos de autenticación incompletos', 401);
      }

      const resultado = await this.servicioNovedades.Crear(data, documento, idRol);

      return response.send(resultado);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      const requestData = request.all();
      await guardarLogError(error, documento ?? '', 'crearNovedad');

      // Si es un error del API externo, propagarlo directamente
      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      if (error instanceof ValidationException)
      {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []
        return CustomException.error(response, 422, "Campos invalidos", messages);
      }

      return CustomException.error(response, 500, "Error al Crear la novedad", [error.message || 'Error desconocido']);
    }
  }

  public async Edita({ request, response }: HttpContextContract) {
    try {
      const requestData = request.all();
      const data = await request.validate(EditarNovedadValidator);

       const fuente = request.header('fuenteDato') || request.header('FuenteDato') || request.header('fuentedato') || request.header('Fuentedato');
       if (!fuente) {
        data.fuenteDato = 'API'
        const payload = await request.obtenerPayloadJWT();
        data.nitProveedor = payload.documento;
      }
      else
      {
        data.fuenteDato = 'WEB'
      }

      const novedad = await this.servicioNovedades.Edita(data);

      const array_procesopendiente: string[] = [];

      if (novedad.tipo_novedad_id == 1){
        array_procesopendiente.push("Relacionar un vehículo o un conductor a la novedad");
      }

      const novedadSerializada = novedad.serialize ? novedad.serialize() : novedad;

      return CustomException.success(
          response,
          200,
          "Novedad actualizada exitosamente",
          ["Novedad actualizada exitosamente"],
          null,
          novedadSerializada,
          {procesopendiente: array_procesopendiente}
      );
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'editarNovedad');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      if (error instanceof ValidationException)
      {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []
        return CustomException.error(response, 422, "Campos invalidos", messages);
      }

      return CustomException.error(response, 500, "Error al editar la novedad", [error.message || 'Error desconocido']);
    }
  }

  public async Desactivar({ request, response }: HttpContextContract) {
    try {

      const data = await request.validate(IdValidator);
      const id = data.id;
      const novedad = await this.servicioNovedades.Desactivar(id);

       return CustomException.success(
          response,
          200,
          "Cambio de estado",
          ["Cambio de estado exitoso"],
          null,
          novedad,
      );
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'desactivarNovedad');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      return CustomException.error(response, 500, "Error al desactivar la novedad", [error.message || 'Error desconocido']);
    }
  }

}
