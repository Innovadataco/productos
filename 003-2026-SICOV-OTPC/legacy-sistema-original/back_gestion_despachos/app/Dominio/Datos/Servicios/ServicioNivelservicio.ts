import { Exception } from "@adonisjs/core/build/standalone";
import { RepositorioNivelservicio } from "App/Dominio/Repositorios/RepositorioNivelservicio";

export class ServicioNivelservicio{

  constructor (private readonly repositorio: RepositorioNivelservicio) { }

  async Listar(obj_filter: any, token: string, documento: string): Promise<any> {
    return this.repositorio.Listar(obj_filter, token, documento);
  }
}
