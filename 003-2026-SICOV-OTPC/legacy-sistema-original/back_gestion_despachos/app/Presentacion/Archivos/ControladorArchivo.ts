
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import axios from 'axios';
import FormData from 'form-data';
import Env from '@ioc:Adonis/Core/Env';

export default class ControladorArchivo {


  public async archivos ({ request, response }:HttpContextContract) {
   const {idVigilado}= request.all();
   if (!idVigilado) {
    return response.status(400).send({mensaje: 'El idVigilado es requerido'})
   }
    const host = Env.get('URL_SERVICIO_ARCHIVOS')
    const rutaRaiz = 'sicov';
    const ruta = 'archivos';
    const endpoint = `/api/v1/${ruta}`
    const archivo = request.file('archivo', {
      extnames: ['pdf'],
    })

    if (!archivo) {
      return response.status(400).send({
        mensaje: 'No se encontro el archivo'
      })
    }

    if (!archivo.isValid) {
      return response.status(415).send({ mensaje: `Formato inválido: no se puede cargar el archivo seleccionado. Inténtalo nuevamente, el tipo de archivo permitido es '.pdf'` })
    }

    const fs = require('fs');
    const path = require('path');

    const archivoTemporal = path.resolve(archivo.tmpPath);

    const formData = new FormData();
    formData.append('archivo', fs.createReadStream(archivoTemporal), {
      filename: archivo.clientName,
      contentType: archivo.headers['content-type'],
    });

    formData.append('idVigilado', idVigilado);
    formData.append('rutaRaiz', rutaRaiz);

    const headers = {
      'Authorization': `Bearer REDACTED-TOKEN-ARCHIVOS`,
      ...formData.getHeaders(),
    };

    try {
      const respuesta = await axios.post(`${host}${endpoint}`, formData, { headers });
      return respuesta.data;
    } catch (error) {
      console.log(error);
      return response.status(500).send({mensaje: 'Error al guardar el archivo'})
    }

  }


  public async obtenerArchivo ({ request, response }:HttpContextContract) {
    const {documento, ruta} = request.all()
    if(!documento || !ruta){
      return response.status(500).send({mensaje: 'Todos los campos son requeridos'})
    }

    const host = Env.get('URL_SERVICIO_ARCHIVOS')
    const endpoint = `/api/v1/archivos`
    const headers = {
      'Authorization': `Bearer REDACTED-TOKEN-ARCHIVOS`
    };

    try {
      const respuesta = await axios.get(`${host}${endpoint}?nombre=${documento}&ruta=${ruta}`, { headers });
      if (respuesta.data.length == 0) {
        return response.status(404).send({ mensaje:'No se encontro el archivo'})
      }
      return respuesta.data;
    } catch (error) {
      console.log(error);

      return response.status(500).send({mensaje: 'Error al obtener el archivo'})
    }


  }



}
