import { Exception } from '@adonisjs/core/build/standalone'
import { DateTime } from 'luxon'
import { RepositorioNovedadesvehiculo } from 'App/Dominio/Repositorios/RepositorioNovedadesvehiculo';
import TblNovedadesvehiculo from 'App/Infraestructura/Datos/Entidad/Novedadesvehiculo';
import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';
import { TokenExterno } from 'App/Dominio/Utilidades/TokenExterno';
import { obtenerDatosAutenticacionUsuario } from './AutenticacionUsuarioHelper';

export class RepositorioNovedadesvehiculoDB implements RepositorioNovedadesvehiculo {
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
      const desdeMillis = DateTime.fromMillis(valor);
      return desdeMillis.isValid ? desdeMillis : null;
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

          let query = TblNovedadesvehiculo.query();

          if (obj_filter.find && obj_filter.find.trim().length  > 0)
          {
              query.where('noh_placa', 'ILIKE', `%${obj_filter.find}%`);
          }

          query.select('*').orderBy('id', 'desc');

          const array_novedades = await query.paginate(obj_filter.page, obj_filter.numero_items);

          return array_novedades;

      } catch (error) {
        throw new Exception("No se pudieron obtener los novedadvehiculo", 500);
      }
  }

  async Crear(data: any, usuario: string, idRol: number): Promise<any> {
      try {
        // Validar que exista el token externo
        const tokenExterno = await this.obtenerTokenExterno();
        const { tokenAutorizacion, nitVigilado } = await obtenerDatosAutenticacionUsuario(usuario, idRol);

        const placa = this.normalizarTexto(data.placa);
        if (!placa) {
          throw new Exception('La placa es requerida para registrar la novedad de vehículo', 400);
        }

        // 1. Guardar localmente primero
        const novedadVehiculoDTO = {
          idNovedad: this.normalizarNumero(data.idNovedad) ?? null,
          placa,
          soat: this.normalizarTexto(data.soat),
          fechaVencimientoSoat: this.normalizarFecha(data.fechaVencimientoSoat),
          revisionTecnicoMecanica: this.normalizarTexto(data.revisionTecnicoMecanica),
          fechaRevisionTecnicoMecanica: this.normalizarFecha(data.fechaRevisionTecnicoMecanica),
          idPolizas: this.normalizarTexto(data.idPolizas),
          tipoPoliza: this.normalizarTexto(data.tipoPoliza),
          tarjetaOperacion: this.normalizarTexto(data.tarjetaOperacion),
          fechaVencimientoTarjetaOperacion: this.normalizarFecha(data.fechaVencimientoTarjetaOperacion),
          idMatenimientoPreventivo: this.normalizarTexto(data.idMatenimientoPreventivo),
          fechaMantenimientoPreventivo: this.normalizarFecha(data.fechaMantenimientoPreventivo),
          idProtocoloAlistamientodiario: this.normalizarTexto(data.idProtocoloAlistamientodiario),
          fechaProtocoloAlistamientodiario: this.normalizarFecha(data.fechaProtocoloAlistamientodiario),
          observaciones: this.normalizarTexto(data.observaciones),
          clase: this.normalizarNumero(data.clase) ?? null,
          nivelServicio: this.normalizarNumero(data.nivelServicio) ?? null,
          idPolizaContractual: this.normalizarTexto(data.idPolizaContractual),
          idPolizaExtracontractual: this.normalizarTexto(data.idPolizaExtracontractual),
          vigenciaContractual: this.normalizarFecha(data.vigenciaContractual)?.toJSDate() ?? null,
          vigenciaExtracontractual: this.normalizarFecha(data.vigenciaExtracontractual)?.toJSDate() ?? null,
          estado: true,
          procesado: false
        };
        const novedadVehiculo = await TblNovedadesvehiculo.create(novedadVehiculoDTO as any);

        // 2. Enviar datos al API externo
        try {
          const urlDespachos = Env.get("URL_DESPACHOS");

          const respuestaNovedadVehiculo = await axios.post(
            `${urlDespachos}/novedadesvehiculo`,
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
          if ((respuestaNovedadVehiculo.status === 200 || respuestaNovedadVehiculo.status === 201) && novedadVehiculo.id) {
            const idNovedadExterno =
              respuestaNovedadVehiculo.data?.array_data?.obj?.id_novedad ||
              respuestaNovedadVehiculo.data?.obj?.id_novedad ||
              respuestaNovedadVehiculo.data?.array_data?.obj?.idNovedad ||
              respuestaNovedadVehiculo.data?.obj?.idNovedad ||
              respuestaNovedadVehiculo.data?.data?.idNovedad ||
              respuestaNovedadVehiculo.data?.idNovedad;

            await TblNovedadesvehiculo.query()
              .where("id", novedadVehiculo.id)
              .update({
                procesado: true,
                idNovedad: idNovedadExterno || data.idNovedad
              });
          }

          return respuestaNovedadVehiculo.data;
        } catch (errorExterno: any) {
          console.error("Error al enviar datos al API externo de novedades vehículo:", errorExterno);
          // Crear excepción con la respuesta completa del API externo si existe
          const exception = new Exception(
            errorExterno.response?.data?.mensaje || errorExterno.response?.data?.message || "Error al comunicarse con el servicio externo de novedades vehículo",
            errorExterno.response?.status || 500
          );
          // Agregar los datos completos del API externo a la excepción
          if (errorExterno.response?.data) {
            (exception as any).responseData = errorExterno.response.data;
          }
          throw exception;
        }
      } catch (error: any) {
        console.error('Error al crear novedad vehículo:', error);
        // Re-lanzar excepciones de tipo Exception para que el controlador las maneje correctamente
        if (error instanceof Exception) {
          throw error;
        }
        throw new Exception("No se pudieron crear las novedadvehiculo", 500);
      }
  }

  async Edita(data: any): Promise<any> {
      try {
        const novedad = await TblNovedadesvehiculo.findByOrFail('id', data.id);
        delete data.id
        novedad.merge(data);
        await novedad.save();
        return novedad
      } catch (error) {
        throw new Exception("No se pudieron Editar los novedadvehiculo", 500);
      }
  }

  async Desactivar(id: number): Promise<any> {
      try {
        const novedad = await TblNovedadesvehiculo.findByOrFail('id', id);
        novedad.merge({ estado: !novedad.estado });
         await novedad.save();
        return novedad
      } catch (error) {
        throw new Exception("No se pudieron desactivar la novedadvehiculo", 500);
      }
  }

   async validarVehiculo(novedad_id: number): Promise<any> {
      try {
        const novedadvehiculo = await TblNovedadesvehiculo.findBy('idNovedad', novedad_id);

        return novedadvehiculo;
      } catch (error) {
        throw new Exception("No se pudo obtener la Llegada de vehiculo", 500);
      }
  }

}
