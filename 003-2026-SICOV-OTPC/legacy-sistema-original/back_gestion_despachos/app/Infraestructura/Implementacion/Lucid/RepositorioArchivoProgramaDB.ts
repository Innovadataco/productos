/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { Exception } from '@adonisjs/core/build/standalone'
import { Paginador } from '../../../Dominio/Paginador';
import { MapeadorPaginacionDB } from './MapeadorPaginacionDB';
import { RepositorioArchivoPrograma } from 'App/Dominio/Repositorios/RepositorioArchivoPrograma';
import TblArchivoPrograma from 'App/Infraestructura/Datos/Entidad/ArchivoPrograma';
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario';
import { TokenExterno } from 'App/Dominio/Utilidades/TokenExterno';
import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';
import { DateTime } from 'luxon';

export class RepositorioArchivoProgramaDB implements RepositorioArchivoPrograma {
  private async obtenerTokenExterno(): Promise<string> {
    const token = await TokenExterno.get();
    if (!token || !TokenExterno.isVigente()) {
      throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
    }
    return token;
  }

  async guardar(nombreOriginal: string, documento: string, ruta: string, idRol: number, tipoId: number, usuario: string): Promise<any> {
    try {
      // Validar que exista el token externo
      const tokenExterno = await this.obtenerTokenExterno();

      // Obtener datos de autenticación según el rol
      let tokenAutorizacion = '';
      let nitVigilado = '';
      let usuarioId = 0;

      const usuarioDb = await TblUsuarios.query().where('identificacion', usuario).first();

      if (!usuarioDb) {
        throw new Exception("Usuario no encontrado", 404);
      }

      if (idRol == 3) {
        nitVigilado = usuarioDb.administrador!;
        const usuarioAdministrador = await TblUsuarios.query().where('identificacion', usuarioDb.administrador!).first();
        if (!usuarioAdministrador) {
          throw new Exception("Usuario administrador no encontrado", 404);
        }
        tokenAutorizacion = usuarioAdministrador.tokenAutorizado || '';
        usuarioId = usuarioAdministrador.id!;
      } else if (idRol == 2) {
        nitVigilado = usuarioDb.identificacion!;
        tokenAutorizacion = usuarioDb.tokenAutorizado || '';
        usuarioId = usuarioDb.id!;
      }

      // Validar que el token no esté vacío
      if (!tokenAutorizacion || tokenAutorizacion.trim() === '') {
        throw new Exception("Token de autorización no encontrado. Por favor, contacte al administrador.", 400);
      }




      await TblArchivoPrograma.query().where('tap_usuario_id', usuarioId!).where('tap_tipo_id', tipoId).update({ estado: false });

      // Obtener la fecha ajustada por TIMEZONE_OFFSET_HOURS y convertir a DateTime (Luxon)
      const offsetEnv = Env.get('TIMEZONE_OFFSET_HOURS', '5');
      const offsetHours = Number.parseInt(offsetEnv, 10);
      const fechaCreacion = DateTime.now().minus({ hours: Number.isNaN(offsetHours) ? 0 : offsetHours });

      const data = {
        nombreOriginal,
        documento,
        ruta,
        usuarioId: usuarioId!,
        tipoId,
        createdAt: fechaCreacion
      };
      const archivo = await TblArchivoPrograma.create(data);



      // Enviar datos al API externo de mantenimiento
      try {
        const urlMantenimientos = Env.get("URL_MATENIMIENTOS");

        const datosArchivo = {
          vigiladoId: parseInt(nitVigilado),
          documento,
          nombreOriginal,
          ruta,
          tipoId
        };

        const respuestaArchivosPrograma = await axios.post(
          `${urlMantenimientos}/archivos_programas`,
          datosArchivo,
          {
            headers: {
              'Authorization': `Bearer ${tokenExterno}`,
              'token': tokenAutorizacion,
              'Content-Type': 'application/json'
            }
          }
        );

       /*  // Si la respuesta es exitosa (200), actualizar el campo procesado
        if (respuestaArchivosPrograma.status === 200 && archivo.id) {
          await TblArchivoPrograma.query()
            .where("id", archivo.id)
            .update({ procesado: true });
        } */

        // Retornar la respuesta del API externo
        return respuestaArchivosPrograma.data;
      } catch (errorExterno: any) {
        // Log del error pero no interrumpir el flujo
        console.error("Error al enviar datos al API externo de mantenimiento:", errorExterno);
        // El mantenimiento queda guardado localmente pero con procesado = false

        // Si hay error, retornar mensaje de error pero indicar que se guardó localmente
        throw new Exception(
          errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de mantenimiento",
          errorExterno.response?.status || 500
        );
      }


    } catch (error) {
      console.log(error);

    }
  }

  async listar(usuarioId: number, tipoId: number): Promise<any> {
    const archivos = new Array();
    const usuario = await TblUsuarios.query().where('identificacion', usuarioId).first()
    const archivosDB = await TblArchivoPrograma.query().where('tap_usuario_id', usuario?.id!).where('tap_tipo_id', tipoId).orderBy('tap_creado', 'desc');
    archivosDB.forEach(archivo => {
      archivos.push({
        documento: archivo.documento,
        nombreOriginal: archivo.nombreOriginal,
        ruta: archivo.ruta,
        estado: archivo.estado,
        fecha: archivo.createdAt
      })
    })
    return archivos
  }

}
