import { Exception } from '@adonisjs/core/build/standalone'
import { DateTime } from 'luxon'
import { RepositorioNovedadesconductor } from 'App/Dominio/Repositorios/RepositorioNovedadesconductor';
import TblNovedadesconductor from 'App/Infraestructura/Datos/Entidad/Novedadesconductor';
import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';
import { TokenExterno } from 'App/Dominio/Utilidades/TokenExterno';
import { obtenerDatosAutenticacionUsuario } from './AutenticacionUsuarioHelper';

export class RepositorioNovedadesconductorDB implements RepositorioNovedadesconductor {
  private normalizarTexto(valor: any): string | null {
    if (valor === undefined || valor === null) {
      return null;
    }

    const texto = String(valor).trim();
    return texto === '' ? null : texto;
  }

  private normalizarNumero(valor: any): number | null {
    if (valor === undefined || valor === null) {
      return null;
    }

    if (typeof valor === 'number') {
      return Number.isFinite(valor) ? valor : null;
    }

    const texto = String(valor).trim();
    if (texto === '') {
      return null;
    }

    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
  }

  private normalizarFecha(valor: any): DateTime | null {
    if (valor === undefined || valor === null) {
      return null;
    }

    if (valor instanceof DateTime) {
      return valor;
    }

    if (valor instanceof Date) {
      return DateTime.fromJSDate(valor);
    }

    if (typeof valor === 'number') {
      const numero = Number(valor);
      const desdeMillis = DateTime.fromMillis(numero);
      if (desdeMillis.isValid) {
        return desdeMillis;
      }
    }

    if (typeof valor === 'string') {
      const texto = valor.trim();
      if (texto === '') {
        return null;
      }

      const candidatos = [
        DateTime.fromISO(texto),
        DateTime.fromFormat(texto, 'yyyy-MM-dd'),
        DateTime.fromFormat(texto, 'dd/MM/yyyy'),
      ];

      for (const candidato of candidatos) {
        if (candidato.isValid) {
          return candidato;
        }
      }
    }

    return null;
  }

  private async obtenerTokenExterno(): Promise<string> {
    const token = await TokenExterno.get();
    if (!token || !TokenExterno.isVigente()) {
      throw new Exception("Su sesión ha expirado. Por favor, vuelva a iniciar sesión", 401);
    }
    return token;
  }

  async Listar(obj_filter:any):Promise<any>{
    try {

          let query = TblNovedadesconductor.query();

          if (obj_filter.find && obj_filter.find.trim().length  > 0)
          {
              query.where('noh_placa', 'ILIKE', `%${obj_filter.find}%`);
          }

          query.select('*').orderBy('id', 'desc');

          const array_novedades = await query.paginate(obj_filter.page, obj_filter.numero_items);

          return array_novedades;

      } catch (error) {
        throw new Exception("No se pudieron obtener los novedad conductor", 500);
      }
  }

  async Crear(data: any, usuario: string, idRol: number): Promise<any> {
      try {
        // Validar que exista el token externo
        const tokenExterno = await this.obtenerTokenExterno();
        const { tokenAutorizacion, nitVigilado } = await obtenerDatosAutenticacionUsuario(usuario, idRol);

        const numeroIdentificacion = this.normalizarTexto(data.numeroIdentificacion);
        if (!numeroIdentificacion) {
          throw new Exception('El número de identificación del conductor es obligatorio', 400);
        }

        const primerNombre = this.normalizarTexto(data.primerNombreConductor);
        if (!primerNombre) {
          throw new Exception('El primer nombre del conductor es obligatorio', 400);
        }

        // 1. Guardar localmente primero
        const novedadConductorDTO = {
          idNovedad: this.normalizarNumero(data.idNovedad) ?? null,
          tipoIdentificacionConductor: this.normalizarTexto(data.tipoIdentificacionConductor),
          numeroIdentificacion,
          primerNombreConductor: primerNombre,
          segundoNombreConductor: this.normalizarTexto(data.segundoNombreConductor),
          primerApellidoConductor: this.normalizarTexto(data.primerApellidoConductor),
          segundoApellidoConductor: this.normalizarTexto(data.segundoApellidoConductor),
          idPruebaAlcoholimetria: this.normalizarTexto(data.idPruebaAlcoholimetria),
          resultadoPruebaAlcoholimetria: this.normalizarTexto(data.resultadoPruebaAlcoholimetria),
          fechaUltimaPruebaAlcoholimetria: this.normalizarFecha(data.fechaUltimaPruebaAlcoholimetria),
          licenciaConduccion: this.normalizarTexto(data.licenciaConduccion),
          idExamenMedico: this.normalizarTexto(data.idExamenMedico),
          fechaUltimoExamenMedico: this.normalizarFecha(data.fechaUltimoExamenMedico),
          observaciones: this.normalizarTexto(data.observaciones),
          fechaVencimientoLicencia: this.normalizarFecha(data.fechaVencimientoLicencia),
          estado: true,
          procesado: false
        };
        const novedadConductor = await TblNovedadesconductor.create(novedadConductorDTO as any);

        // 2. Enviar datos al API externo
        try {
          const urlDespachos = Env.get("URL_DESPACHOS");

          const respuestaNovedadConductor = await axios.post(
            `${urlDespachos}/novedadesconductor`,
            data,
            {
              headers: {
                'Authorization': `Bearer ${tokenExterno}`,
                'token': tokenAutorizacion,
                'documento': nitVigilado,
                'Content-Type': 'application/json'
              }
            }
          );

          // 3. Si la respuesta es exitosa, actualizar procesado e idNovedad
          if ((respuestaNovedadConductor.status === 200 || respuestaNovedadConductor.status === 201) && novedadConductor.id) {
            const idNovedadExterno =
              respuestaNovedadConductor.data?.array_data?.obj?.id_novedad ||
              respuestaNovedadConductor.data?.obj?.id_novedad ||
              respuestaNovedadConductor.data?.array_data?.obj?.idNovedad ||
              respuestaNovedadConductor.data?.obj?.idNovedad ||
              respuestaNovedadConductor.data?.data?.idNovedad ||
              respuestaNovedadConductor.data?.idNovedad;

            await TblNovedadesconductor.query()
              .where("id", novedadConductor.id)
              .update({
                procesado: true,
                idNovedad: idNovedadExterno || data.idNovedad
              });
          }

          return respuestaNovedadConductor.data;
        } catch (errorExterno: any) {
          console.error("Error al enviar datos al API externo de novedades conductor:", errorExterno);
          // Crear excepción con la respuesta completa del API externo si existe
          const exception = new Exception(
            errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de novedades conductor",
            errorExterno.response?.status || 500
          );
          // Agregar los datos completos del API externo a la excepción
          if (errorExterno.response?.data) {
            (exception as any).responseData = errorExterno.response.data;
          }
          throw exception;
        }
      } catch (error: any) {
        console.error('Error al crear novedad conductor:', error);
        // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
        if (error instanceof Exception) {
          throw error;
        }
        throw new Exception("No se pudieron crear las novedad conductor", 500);
      }
  }

  async Edita(data: any): Promise<any> {
      try {
        const novedad = await TblNovedadesconductor.findByOrFail('id', data.id);
        delete data.id
        novedad.merge(data);
        await novedad.save();
        return novedad
      } catch (error) {
        throw new Exception("No se pudieron Editar los novedad conductor", 500);
      }
  }

  async Desactivar(id: number): Promise<any> {
      try {
        const novedad = await TblNovedadesconductor.findByOrFail('id', id);
        novedad.merge({ estado: !novedad.estado });
         await novedad.save();
        return novedad
      } catch (error) {
        throw new Exception("No se pudieron desactivar la novedad conductor", 500);
      }
  }

}
