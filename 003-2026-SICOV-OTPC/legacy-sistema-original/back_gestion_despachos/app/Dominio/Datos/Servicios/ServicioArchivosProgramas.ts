import { RepositorioArchivoPrograma } from "App/Dominio/Repositorios/RepositorioArchivoPrograma";

export class ServicioArchivosProgramas{
 constructor (private repositorio: RepositorioArchivoPrograma) { }

  async guardar (nombreOriginal:string, documento:string, ruta:string, idRol:number, tipoId:number, usuario:string): Promise<any>{
    return this.repositorio.guardar(nombreOriginal, documento, ruta, idRol, tipoId, usuario)
  }

  async listar (usuarioId:number, tipoId:number): Promise<any>{
    return this.repositorio.listar(usuarioId, tipoId)
  }
}
