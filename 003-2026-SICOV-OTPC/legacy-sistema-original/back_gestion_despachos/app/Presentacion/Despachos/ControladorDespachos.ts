/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";

import { despachoSchema, despachoMessages, validarFechaHoraDespacho } from './ValidadorDespacho'
import CustomException from "App/Exceptions/CustomException";
import { ValidationException } from '@ioc:Adonis/Core/Validator'
import { guardarLogError } from 'App/Dominio/guardarLogError';
import { Exception } from "@adonisjs/core/build/standalone";
import { ServicioDespachos } from "App/Dominio/Datos/Servicios/ServicioDespachos";
import { RepositorioDesppachosDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioDespachosDB";

export default class ControladorDespachos {
  private servicioDespacho = new ServicioDespachos(new RepositorioDesppachosDB());
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

  public async Listar({ request, response }: HttpContextContract) {
    try {
      const payload = await request.obtenerPayloadJWT();
      const documento = payload?.documento || '';
      const idRol = Number(payload?.idRol);
      if (!Number.isFinite(idRol)) {
        throw new Exception('No se pudo determinar el rol del usuario autenticado', 400);
      }
      const { nit } = request.all();

      const resultado = await this.servicioDespacho.Listar(documento, idRol, nit);

      return response.status(200).send(resultado);

    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'listarDespachos');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      return CustomException.error(
        response,
        500,
        "Error al listar los despachos",
        [error.message || 'Error desconocido']
      );
    }
  }

  public async Listados({ request, response }: HttpContextContract) {
    try {
      const { nit, page, numero_items } = request.all();

      return CustomException.success(
        response,
        200,
        'Listado de despachos',
        ['Listado generado exitosamente'],
        await this.servicioDespacho.Listados( nit, Number(page), Number(numero_items))
      );

    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      const requestData = request.all();
      await guardarLogError(error, documento ?? '', 'listadosDespachos');

      const statusCode = error.status || 500;


      return CustomException.error(
        response,
        statusCode,
        "Error al listar los despachos",
        [error.messages || error.message]
      );
    }
  }

  public async Crear({ request, response }: HttpContextContract) {
    try {
      const requestData = request.all();
      const data = await request.validate({ schema: despachoSchema, messages: despachoMessages });
      const fuente = request.header('fuenteDato') || request.header('FuenteDato') || request.header('fuentedato') || request.header('Fuentedato');

      // Redondear a 2 decimales antes de guardar
      if (data.valorTiquete !== undefined) {
        data.valorTiquete = Math.round(data.valorTiquete * 100) / 100;
      }
      if (data.valorTotalTasaUso !== undefined) {
        data.valorTotalTasaUso = Math.round(data.valorTotalTasaUso * 100) / 100;
      }

      if (!fuente) {
        data.fuenteDato = 'API'
        const payload = await request.obtenerPayloadJWT();
        data.nitProveedor = payload.documento;
      }
      else
      {
        data.fuenteDato = 'WEB'
      }

      // Validación adicional: fechaSalida no puede ser futura y, si es hoy, horaSalida no puede ser mayor a la actual
      const erroresFechaHora = validarFechaHoraDespacho(data);
      if (erroresFechaHora.length > 0) {
        const payload = await request.obtenerPayloadJWT();


        return CustomException.error(
          response,
          422,
          'Datos inválidos',
          erroresFechaHora.map((e: any) => e.message)
        );
      }

      const despacho = await this.servicioDespacho.Crear(data);

      // Registrar auditoría de creación exitosa
      const payload = await request.obtenerPayloadJWT();
      const despachoSerializado = despacho.serialize ? despacho.serialize() : despacho;


      return CustomException.success(
        response,
        200,
        "Despacho creado exitosamente",
        ["Despacho creado exitosamente"],
        null,
        {
          ...despachoSerializado
        }
      );
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      const requestData = request.all();
      await guardarLogError(error, documento ?? '', 'crearDespacho');

      if (error instanceof ValidationException) {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []


        return CustomException.error(
          response,
          422,
          "Datos inválidos",
          messages
        );
      }



      return CustomException.error(
        response,
        500,
        "Error al Crear el despacho",
        [error.messages || error.message]
      );
    }
  }

  public async Edita({ request, response }: HttpContextContract) {
    try {
       const requestData = request.all();
       const fuente = request.header('fuenteDato') || request.header('FuenteDato') || request.header('fuentedato') || request.header('Fuentedato');
      const { id } = request.all()
      // Validar igual que en Crear
      const data = await request.validate({ schema: despachoSchema, messages: despachoMessages });

      // Redondear a 2 decimales antes de guardar
      if (data.valorTiquete !== undefined) {
        data.valorTiquete = Math.round(data.valorTiquete * 100) / 100;
      }
      if (data.valorTotalTasaUso !== undefined) {
        data.valorTotalTasaUso = Math.round(data.valorTotalTasaUso * 100) / 100;
      }

    if (!fuente) {
        data.fuenteDato = 'API'
        const payload = await request.obtenerPayloadJWT();
        data.nitProveedor = payload.documento;
      }
      else
      {
        data.fuenteDato = 'WEB'
      }

      const despacho = await this.servicioDespacho.Edita(id, data);

      // Registrar auditoría de actualización exitosa
      const payload = await request.obtenerPayloadJWT();
      const despachoSerializado = despacho.serialize ? despacho.serialize() : despacho;


      return CustomException.success(
        response,
        200,
        "Despacho actualizado exitosamente",
        ["Despacho actualizado exitosamente"],
        null,
        {
          ...despachoSerializado
        }
      );
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      const requestData = request.all();
      await guardarLogError(error, documento ?? '', 'editarDespacho');

      if (error instanceof ValidationException) {
        const messages = (error as any)?.messages?.errors?.map((msg: any) => msg.message) || []


        return CustomException.error(
          response,
          422,
          "Datos inválidos",
          messages
        );
      }



      return CustomException.error(
        response,
        500,
        "Error al editar el despacho",
        [error.messages || error.message]
      );
    }
  }

  public async Desactivar({ request, response }: HttpContextContract) {
    try {
      const { id } = request.all()
      const despacho = await this.servicioDespacho.Desactivar(id);
      return CustomException.success(
        response,
        200,
        "Cambio de estado",
        ["Cambio de estado exitoso"],
        null,
        despacho
      );
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      const requestData = request.all();
      await guardarLogError(error, documento ?? '', 'desactivarDespacho');

      return CustomException.error(
        response,
        500,
        "Error en el cambio de estado exitoso",
        [error.messages || error.message]
      );
    }
  }

  public async BuscarPorId({ request, params, response }: HttpContextContract) {
    try {
      const id = Number(params.id);

      const payload = await request.obtenerPayloadJWT();
      const documento = payload?.documento || '';
      const idRol = payload?.idRol;

      if (!documento || typeof idRol !== 'number') {
        throw new Exception('Datos de autenticación incompletos', 401);
      }

      const resultado = await this.servicioDespacho.BuscarPorId(id, documento, idRol);

      return response.status(200).send(resultado);
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'buscarDespachoPorId');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      return CustomException.error(
        response,
        500,
        "Error al buscar el despacho",
        [error.message || 'Error desconocido']
      );
    }
  }

  public async BuscarPorPlacaVehiculo({ request, params, response }: HttpContextContract) {
    try {
      const placa = params.placa;
      if (!placa) {
        return CustomException.error(
          response,
          400,
          "La placa es requerida",
          ["La placa del vehículo es requerida"]
        );
      }

      // Obtener credenciales para API externo
      const payload = await request.obtenerPayloadJWT();
      const documento = payload?.documento || '';
      const idRol = payload?.idRol;

      if (!documento || typeof idRol !== 'number') {
        throw new Exception('Datos de autenticación incompletos', 401);
      }

      const {fechaSalida} = request.all();
      const resultado = await this.servicioDespacho.BuscarPorPlacaVehiculo(placa, documento, idRol, fechaSalida);

      return CustomException.success(
        response,
        200,
        "Búsqueda por placa exitosa",
        ["Despacho encontrado"],
        resultado
      );
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      await guardarLogError(error, documento ?? '', 'buscarDespachoPorPlaca');

      if (error instanceof Exception) {
        return this.manejarError(error, response);
      }

      return CustomException.error(
        response,
        500,
        "Error al buscar despacho por placa de vehículo",
        [error.message || 'Error desconocido']
      );
    }
  }


/*   public async ValidarIntegradora({ request, response }: HttpContextContract) {
    try {
      const { conductor_uno, placa, nit, fechaSalida } = request.all();
      const token = request.header('Authorization');
      const resultado = await this.servicioIntegradoraValidator.consultarIntegradora(conductor_uno, placa, nit, token!, fechaSalida);
      return CustomException.success(
        response,
        200,
        "Validación de integradora exitosa",
        ["Integradora validada"],
        null,
        resultado
      );
    } catch (error) {
      const { documento } = await request.obtenerPayloadJWT?.() || {};
      const requestData = request.all();
      //await guardarLogError(error, documento ?? '', 'validarIntegradora');

      return CustomException.error(
        response,
        500,
        "Error al validar integradora",
        [error.messages || error.message]
      );
    }
  } */

}
