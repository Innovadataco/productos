import { Exception } from "@adonisjs/core/build/standalone";
import { RepositorioNovedades } from "App/Dominio/Repositorios/RepositorioNovedades";



export class ServicioNovedades{
  constructor (private readonly repositorio: RepositorioNovedades) { }

  async Listar(obj_filter: any): Promise<any> {
    return this.repositorio.Listar(obj_filter);
  }

  async Crear(data: any, usuario: string, idRol: number): Promise<any> {
    return this.repositorio.Crear(data, usuario, idRol);
  }

  async Edita(data: any): Promise<any> {
    var obj_novedad = await this.Obtener(data.id);

    if (!obj_novedad.estado)
    {
        throw new Exception(`La novedad se encuentra inactiva`, 409);
    }

    return this.repositorio.Edita(data);
  }

  async Desactivar(id: number): Promise<any> {
    return this.repositorio.Desactivar(id);
  }

  async Obtener(id: number): Promise<any> {
    return this.repositorio.Obtener(id);
  }
}
