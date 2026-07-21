import { RepositorioNovedadesconductor } from "App/Dominio/Repositorios/RepositorioNovedadesconductor";
import { ServicioNovedades } from "App/Dominio/Datos/Servicios/ServicioNovedades";
import { RepositorioNovedadesDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioNovedadesDB";
import { Exception } from "@adonisjs/core/build/standalone";
import axios from "axios";
import Env from '@ioc:Adonis/Core/Env';

export class ServicioNovedadesconductor{
  private servicioNovedades = new ServicioNovedades(new RepositorioNovedadesDB());
  private tokenSistema = 'REDACTED-TOKEN-SISTEMA'
  private headers = {
    Authorization: `Bearer ${this.tokenSistema}`
  }

  constructor (
    private readonly repositorio: RepositorioNovedadesconductor
  ) { }

  async Listar(obj_filter: any): Promise<any> {
    return this.repositorio.Listar(obj_filter);
  }

  async Crear(data: any, usuario: string, idRol: number): Promise<any> {
    return this.repositorio.Crear(data, usuario, idRol);
  }

  async Edita(data: any): Promise<any> {
    var obj_novedad = await this.servicioNovedades.Obtener(data.idNovedad);

    if (!obj_novedad.estado)
    {
       throw new Exception(`La novedad se encuentra inactiva`, 409);
    }

    // Validación principal (si se envían)
    if (data.idPruebaAlcoholimetria && data.numeroIdentificacion) {
      const prueba = await this.consultarPrueba(data.idPruebaAlcoholimetria)
      if (prueba.numeroIdentificacion !== data.numeroIdentificacion) {
        throw new Exception('El número de identificación no coincide con la prueba de alcoholimetría principal', 422)
      }
      data.resultadoPruebaAlcoholimetria = prueba.resultado
      data.fechaUltimaPruebaAlcoholimetria = prueba.fechaPrueba
    }

    if (data.idExamenMedico && data.numeroIdentificacion) {
      const examen = await this.consultarExamen(data.idExamenMedico)
      if (examen.numeroIdentificacion !== data.numeroIdentificacion) {
        throw new Exception('El número de identificación no coincide con el examen médico principal', 422)
      }
      data.observaciones = examen.resultado
      data.fechaUltimoExamenMedico = examen.fechaExamen
    }

    return this.repositorio.Edita(data);
  }

  async Desactivar(id: number): Promise<any> {
    return this.repositorio.Desactivar(id);
  }

  private async consultarPrueba(id: number) {
    try
    {
      const url = `${Env.get('URL_ALCOHOLIMETRIA')}/${id}`
      const { data } = await axios.get(url, { headers: this.headers })
      return data
    }
    catch (error)
    {
      return {};
    }
  }

  private async consultarExamen(id: number) {
    try
    {
      const url = `${Env.get('URL_EXAMENMEDICO')}/${id}`
      const { data } = await axios.get(url, { headers: this.headers })
      return data
    }
    catch (error)
    {
      return {};
    }
  }
}
