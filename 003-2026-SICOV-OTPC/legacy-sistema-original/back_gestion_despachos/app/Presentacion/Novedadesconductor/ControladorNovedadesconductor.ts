/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { ServicioNovedadesconductor } from "App/Dominio/Datos/Servicios/ServicioNovedadesconductor";
import { RepositorioNovedadesconductorDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioNovedadesconductorDB";
import CrearValidator from 'App/Presentacion/Novedadesconductor/Validadores/CrearValidator';
import EditarValidator from 'App/Presentacion/Novedadesconductor/Validadores/EditarValidator';
import ListarValidator from 'App/Presentacion/Novedadesconductor/Validadores/ListarValidator';
import IdValidator from 'App/Presentacion/Novedadesconductor/Validadores/IdValidator';
import { ValidationException } from '@ioc:Adonis/Core/Validator';
import { guardarLogError } from 'App/Dominio/guardarLogError';
import CustomException from "App/Exceptions/CustomException";
import { Exception } from "@adonisjs/core/build/standalone";

export default class ControladorNovedadesconductor {
  private servicioNovedadesconductor = new ServicioNovedadesconductor(new RepositorioNovedadesconductorDB());

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
      const obj_request = await request.validate(ListarValidator);

      return CustomException.success(
        response,
        200,
        'Listado de novedades del conductor',
        ['Listado generado exitosamente'],
        await this.servicioNovedadesconductor.Listar(obj_request)
      );
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'listarNovedadesConductor');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      if (error instanceof ValidationException) {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []
        return CustomException.error(response, 422, "Campos invalidos", messages);
      }

      return CustomException.error(response, 500, "Error al listar la novedad del conductor", [error.message || 'Error desconocido']);
    }
  }

  public async Crear({ request, response }: HttpContextContract) {
    try {
      const data = request.all();

      const payload = await request.obtenerPayloadJWT();
      const documento = payload?.documento || '';
      const idRol = payload?.idRol;

      if (!documento || typeof idRol !== 'number') {
        throw new Exception('Datos de autenticación incompletos', 401);
      }

      const resultado = await this.servicioNovedadesconductor.Crear(data, documento, idRol);

      return response.send(resultado);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'crearNovedadConductor');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      if (error instanceof ValidationException) {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []
        return CustomException.error(response, 422, "Campos invalidos", messages);
      }

      return CustomException.error(response, 500, "Error al crear la novedad del conductor", [error.message || 'Error desconocido']);
    }
  }

  public async Edita({ request, response }: HttpContextContract) {
    try {
      const requestData = request.all();
      const data = await request.validate(EditarValidator);
      const novedad = await this.servicioNovedadesconductor.Edita(data);

      const novedadSerializada = novedad.serialize ? novedad.serialize() : novedad;

      return CustomException.success(
        response,
        200,
        "Novedad del conductor actualizada correctamente",
        ["Novedad del conductor actualizada correctamente"],
        novedadSerializada
      );
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'editarNovedadConductor');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      if (error instanceof ValidationException) {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []
        return CustomException.error(response, 422, "Campos invalidos", messages);
      }

      return CustomException.error(response, 500, "Error al editar la novedad del conductor", [error.message || 'Error desconocido']);
    }
  }

  public async Desactivar({ request, response }: HttpContextContract) {
    try {
      const data = await request.validate(IdValidator);
      const id = data.id;
      const novedad = await this.servicioNovedadesconductor.Desactivar(id);

      return CustomException.success(
        response,
        200,
        "Cambio de estado",
        ["Cambio de estado exitoso"],
        null,
        novedad
      );
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'desactivarNovedadConductor');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      if (error instanceof ValidationException) {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []
        return CustomException.error(response, 422, "Campos invalidos", messages);
      }

      return CustomException.error(response, 500, "Error al desactivar la novedad del conductor", [error.message || 'Error desconocido']);
    }
  }
}
