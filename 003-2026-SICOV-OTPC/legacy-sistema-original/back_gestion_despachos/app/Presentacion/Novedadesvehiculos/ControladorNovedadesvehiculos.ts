/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { ServicioNovedadesvehiculo } from "App/Dominio/Datos/Servicios/ServicioNovedadesvehiculo";
import { RepositorioNovedadesvehiculoDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioNovedadesvehiculoDB";
import CrearValidator from 'App/Presentacion/Novedadesvehiculos/Validadores/CrearValidator'
import EditarValidator from 'App/Presentacion/Novedadesvehiculos/Validadores/EditarValidator'
import ListarValidator from 'App/Presentacion/Novedadesvehiculos/Validadores/ListarValidator'
import IdValidator from 'App/Presentacion/Novedadesvehiculos/Validadores/IdValidator'
import CustomException from "App/Exceptions/CustomException";
import { ValidationException } from '@ioc:Adonis/Core/Validator'
import { guardarLogError } from 'App/Dominio/guardarLogError';
import { Exception } from "@adonisjs/core/build/standalone";

export default class ControladorNovedadesvehiculos {
  private servicioNovedadesvehiculo = new ServicioNovedadesvehiculo(new RepositorioNovedadesvehiculoDB());

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
        "Listado de novedades de vehículos",
        ["Listado generado exitosamente"],
        await this.servicioNovedadesvehiculo.Listar(obj_request)
      );

    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'listarNovedadesVehiculo');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      if (error instanceof ValidationException) {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []
        return CustomException.error(response, 422, "Campos invalidos", messages);
      }

      return CustomException.error(response, 500, "Error al listar las novedades del vehículo", [error.message || 'Error desconocido']);
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

      const resultado = await this.servicioNovedadesvehiculo.Crear(data, documento, idRol);

      return response.send(resultado);

    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'crearNovedadVehiculo');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      if (error instanceof ValidationException) {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []
        return CustomException.error(response, 422, "Campos invalidos", messages);
      }

      return CustomException.error(response, 500, "Error al crear la novedad del vehículo", [error.message || 'Error desconocido']);
    }
  }

  public async Edita({ request, response }: HttpContextContract) {
    try {
      const requestData = request.all();
      const data = await request.validate(EditarValidator);
      const novedad = await this.servicioNovedadesvehiculo.Edita(data);

      const novedadSerializada = novedad.serialize ? novedad.serialize() : novedad;

      return CustomException.success(
        response,
        200,
        "Novedad de vehículo actualizada",
        ["Novedad de vehículo actualizada correctamente"],
        novedadSerializada
      );

    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'editarNovedadVehiculo');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      if (error instanceof ValidationException) {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []
        return CustomException.error(response, 422, "Campos invalidos", messages);
      }

      return CustomException.error(response, 500, "Error al editar la novedad del vehículo", [error.message || 'Error desconocido']);
    }
  }

  public async Desactivar({ request, response }: HttpContextContract) {
    try {
      const data = await request.validate(IdValidator);
      const id = data.id;
      const novedad = await this.servicioNovedadesvehiculo.Desactivar(id);

      return CustomException.success(
        response,
        200,
        "Cambio de estado exitoso",
        ["Cambio de estado exitoso"],
        null,
        novedad
      );

    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'desactivarNovedadVehiculo');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      if (error instanceof ValidationException) {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []
        return CustomException.error(response, 422, "Campos invalidos", messages);
      }

      return CustomException.error(response, 500, "Error al desactivar la novedad del vehículo", [error.message || 'Error desconocido']);
    }
  }
}
