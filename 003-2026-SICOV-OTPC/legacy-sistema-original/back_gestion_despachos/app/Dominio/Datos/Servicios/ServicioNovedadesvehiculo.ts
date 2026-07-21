import { Exception } from "@adonisjs/core/build/standalone";
import { RepositorioNovedadesvehiculo } from "App/Dominio/Repositorios/RepositorioNovedadesvehiculo";
import { ServicioNovedades } from "App/Dominio/Datos/Servicios/ServicioNovedades";
import { RepositorioNovedadesDB } from "App/Infraestructura/Implementacion/Lucid/RepositorioNovedadesDB";

export class ServicioNovedadesvehiculo{
  private servicioNovedades = new ServicioNovedades(new RepositorioNovedadesDB());

  constructor (private readonly repositorio: RepositorioNovedadesvehiculo) { }

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

    return this.repositorio.Edita(data);
  }

  async Desactivar(id: number): Promise<any> {
    return this.repositorio.Desactivar(id);
  }

  async validarVehiculo(novedad_id: number): Promise<any> {
    return this.repositorio.validarVehiculo(novedad_id);
  }
}
