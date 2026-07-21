import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import axios from 'axios';
import FormData from 'form-data';
import Env from '@ioc:Adonis/Core/Env';
import { ServicioArchivosProgramas } from 'App/Dominio/Datos/Servicios/ServicioArchivosProgramas';
import { RepositorioArchivoProgramaDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioArchivoProgramaDB';
import { error } from 'console';

export default class ControladorArchivosProgramas {
private servicio: ServicioArchivosProgramas
  constructor(){
    this.servicio = new ServicioArchivosProgramas(new RepositorioArchivoProgramaDB())
  }

  public async guardar ({ request, response }:HttpContextContract) {
    const { tipoId, documento, nombreOriginal, ruta,} = request.all();

    if (!tipoId || !documento || !nombreOriginal || !ruta ) {
      return response.status(400).send({ mensaje: 'Todos los campos son requeridos'});
    }

    if(tipoId != 1 && tipoId != 2 && tipoId != 3){
      return response.status(400).send({ mensaje: 'El tipoId no es valido'})
    }

    const payload = await request.obtenerPayloadJWT()
    const usuario = payload.documento;
    const idRol = payload.idRol;

    try {
     return await this.servicio.guardar(nombreOriginal, documento, ruta, idRol, tipoId, usuario);

    } catch (error) {
      console.error('Error en la solicitud:', error.message);
    }

  }

  public async listar ({ request, response }:HttpContextContract) {
    const { tipoId, vigiladoId} = request.all();
    if (!tipoId || !vigiladoId) {
      return response.status(400).send({ mensaje: 'Todos los campos son requeridos'});
    }
    try {
      const respuesta = await this.servicio.listar(vigiladoId,tipoId);
      if(respuesta.length == 0){
        return response.status(404).send({ mensaje: 'No se encontraron archivos'})
      }
     return respuesta

    } catch (error) {
      console.error('Error en la solicitud:', error.message);
      return response.status(500).send({ mensaje: 'Error en el servidor'})
    }

  }



}
